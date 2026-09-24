import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { useSocial } from '../../context/SocialContext';
import {
  reactToPost, unreactToPost, savePost, unsavePost, deletePost, reportPost, blockPostAuthor,
} from '../../data/community';
import { applyReaction, mergePage, canEditPost } from '../../data/socialCore';
import { OptionSheet } from './Sheet';
import ReportSheet from './ReportSheet';
import { errorText } from './format';
import { showAlert } from '../dialogs';

/**
 * Lista paginada genérica. `fetchPage(cursor)` → { items, next }. Descarta
 * respuestas viejas si los filtros cambiaron mientras tanto.
 */
export function usePaged(fetchPage, deps = []) {
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const reqId = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(async (mode = 'initial') => {
    const id = ++reqId.current;
    if (mode === 'initial') { setLoading(true); setItems([]); setNext(null); }
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      const r = await fetchRef.current(null);
      if (id !== reqId.current) return;
      setItems(r.items);
      setNext(r.next ?? null);
    } catch (e) {
      if (id !== reqId.current) return;
      setError(e);
    } finally {
      if (id === reqId.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => { load('initial'); }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (!next || loadingMore || loading || refreshing) return;
    const id = reqId.current;
    setLoadingMore(true);
    try {
      const r = await fetchRef.current(next);
      if (id !== reqId.current) return;
      setItems(prev => mergePage(prev, r.items));
      setNext(r.next ?? null);
    } catch {
      // Sin red al paginar: se queda donde está; el siguiente scroll reintenta.
    } finally {
      if (id === reqId.current) setLoadingMore(false);
    }
  }, [next, loadingMore, loading, refreshing]);

  return {
    items, setItems, hasMore: !!next, loading, refreshing, loadingMore, error,
    refresh: () => load('refresh'), reload: () => load('initial'), loadMore,
  };
}

/**
 * Mantiene una lista de posts sincronizada con lo que pasa en otras
 * pantallas (bus de SocialContext): cambios, borrados y bloqueos.
 */
export function usePostSync(setItems, { onBlocked, onCreated } = {}) {
  const { subscribe } = useSocial();
  const cb = useRef({ onBlocked, onCreated });
  cb.current = { onBlocked, onCreated };
  useEffect(() => subscribe((ev) => {
    if (ev.type === 'post' && ev.post) {
      setItems(prev => prev.map(p => (p.id === ev.post.id ? ev.post : p)));
    } else if (ev.type === 'postDeleted') {
      setItems(prev => prev.filter(p => p.id !== ev.id));
    } else if (ev.type === 'blocked') {
      cb.current.onBlocked?.();
    } else if (ev.type === 'postCreated' && ev.post) {
      cb.current.onCreated?.(ev.post);
    }
  }), [subscribe, setItems]);
}

/**
 * Acciones de una tarjeta de post: reaccionar, guardar, menú (editar,
 * borrar, reportar, bloquear), abrir autor, abrir detalle, ir a Sos.
 * `update(post)` y `remove(id)` actualizan la lista local; los cambios se
 * difunden también por el bus para las demás pantallas.
 */
export function usePostActions({ update, remove, onDeleted, onBlocked } = {}) {
  const navigation = useNavigation();
  const { t, sessionToken } = useApp();
  const { isV1, emit, showToast } = useSocial();
  const [menuPost, setMenuPost] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const inFlight = useRef(new Set());

  const publish = useCallback((post) => {
    update?.(post);
    emit({ type: 'post', post });
  }, [update, emit]);

  const onReact = useCallback(async (post, kind) => {
    if (inFlight.current.has(post.id)) return;
    inFlight.current.add(post.id);
    const optimistic = applyReaction(post, kind);
    publish(optimistic);
    try {
      if (kind) await reactToPost(sessionToken, post.id, kind);
      else await unreactToPost(sessionToken, post.id);
    } catch (e) {
      publish(post);
      showToast(errorText(e, t));
    } finally {
      inFlight.current.delete(post.id);
    }
  }, [sessionToken, publish, showToast, t]);

  const onToggleSave = useCallback(async (post) => {
    if (inFlight.current.has(`s${post.id}`)) return;
    inFlight.current.add(`s${post.id}`);
    const saved = !post.savedByMe;
    publish({ ...post, savedByMe: saved });
    try {
      if (saved) await savePost(sessionToken, post.id);
      else await unsavePost(sessionToken, post.id);
      if (saved) showToast(t.socSavedToast);
    } catch (e) {
      publish(post);
      showToast(errorText(e, t));
    } finally {
      inFlight.current.delete(`s${post.id}`);
    }
  }, [sessionToken, publish, showToast, t]);

  const onAuthorPress = useCallback((publicId) => {
    if (publicId) navigation.navigate('UserProfile', { publicId });
  }, [navigation]);

  const onOpen = useCallback((post) => {
    navigation.navigate('PostDetail', { post, postId: post.id });
  }, [navigation]);

  const onSos = useCallback(() => navigation.navigate('Sos'), [navigation]);

  const confirmDelete = (post) => {
    showAlert(t.socDeletePostTitle, t.socDeletePostBody, [
      { text: t.socCancel, style: 'cancel' },
      {
        text: t.socDelete, style: 'destructive',
        onPress: async () => {
          try {
            await deletePost(sessionToken, post.id);
            remove?.(post.id);
            emit({ type: 'postDeleted', id: post.id });
            onDeleted?.(post);
          } catch (e) {
            showAlert(t.socErrTitle, errorText(e, t));
          }
        },
      },
    ]);
  };

  const confirmBlock = (post) => {
    // Algo anónimo: bloquear oculta solo esto (ver API.md, bloqueos).
    const anon = !post.author?.publicId;
    showAlert(t.socBlockTitle, anon ? t.socBlockAnonBody : t.socBlockBody, [
      { text: t.socCancel, style: 'cancel' },
      {
        text: t.socBlockConfirm, style: 'destructive',
        onPress: async () => {
          try {
            await blockPostAuthor(sessionToken, post.id);
            remove?.(post.id);
            emit({ type: 'blocked' });
            showToast(anon ? t.socBlockAnonDone : t.socBlockDone);
            onBlocked?.(post);
          } catch (e) {
            showAlert(t.socErrTitle, errorText(e, t));
          }
        },
      },
    ]);
  };

  const options = [];
  if (menuPost) {
    const p = menuPost;
    if (p.isOwn) {
      // El API responde 409 no_editable a lo rechazado, lo quitado, lo oculto
      // por reportes y lo retenido por crisis (editarlo sería saltarse la
      // decisión o borrar la alerta): no se ofrece. Ver canEditPost.
      if (!isV1 && canEditPost(p)) {
        options.push({ key: 'edit', label: t.socEditPost, onPress: () => navigation.navigate('Compose', { postId: p.id, post: p }) });
      }
      options.push({ key: 'delete', label: t.socDeletePost, destructive: true, onPress: () => confirmDelete(p) });
    } else {
      if (p.author?.publicId) {
        options.push({ key: 'profile', label: t.socViewProfile, onPress: () => onAuthorPress(p.author.publicId) });
      }
      options.push({ key: 'report', label: t.socReportPost, onPress: () => setReportTarget(p) });
      if (!isV1) options.push({ key: 'block', label: t.socBlockAuthor, destructive: true, onPress: () => confirmBlock(p) });
    }
  }

  const elements = (
    <>
      <OptionSheet
        visible={!!menuPost}
        onClose={() => setMenuPost(null)}
        options={options}
        cancelLabel={t.socCancel}
      />
      <ReportSheet
        visible={!!reportTarget}
        title={t.socReportPost}
        onClose={() => setReportTarget(null)}
        onSubmit={(reason, detail) => reportPost(sessionToken, reportTarget.id, reason, detail)}
        onSeeSupport={onSos}
      />
    </>
  );

  return {
    onReact,
    onToggleSave: isV1 ? undefined : onToggleSave,
    onMenu: setMenuPost,
    onAuthorPress,
    onOpen,
    onSos,
    elements,
    v1: isV1,
  };
}
