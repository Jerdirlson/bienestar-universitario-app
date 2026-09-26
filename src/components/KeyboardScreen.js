import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

/**
 * Envoltorio compartido para toda pantalla con `TextInput` (o con una barra
 * de acción fija abajo que el teclado pueda tapar).
 *
 * Por qué existe: desde el SDK 55 de Expo, edge-to-edge en Android es
 * obligatorio (ya no se puede desactivar con `android.edgeToEdgeEnabled` en
 * `app.json`, esa clave se quitó del esquema), y con edge-to-edge Android
 * deja de redimensionar la ventana cuando aparece el
 * teclado (eso solo pasaba con `windowSoftInputMode="adjustResize"`, que
 * edge-to-edge desactiva de hecho). El patrón viejo del repo
 * (`Platform.OS === 'ios' ? 'padding' : undefined`) dejaba a Android sin
 * ningún ajuste: el teclado se dibujaba encima de la pantalla y tapaba el
 * campo activo y los botones de abajo (Publicar, Guardar, Enviar...).
 *
 * `behavior`: en iOS 'padding' es lo de siempre. En Android, con edge-to-edge
 * ya no hay redimensionado automático que compense, así que hay que hacerlo
 * a mano; se usa 'height' porque encaja mejor con el patrón de este repo
 * (un `ScrollView` de contenido con `flex: 1` más un pie de acción fijo
 * fuera de él, ambos dentro de un contenedor de columna): 'height' reduce la
 * altura del propio contenedor cuando aparece el teclado, y el `ScrollView`
 * absorbe esa reducción solo; con 'padding' el resultado visual es similar,
 * pero 'height' se ve más estable en Android cuando además hay un pie fijo
 * fuera del ScrollView (menos salto al mostrar/ocultar teclado).
 */
export default function KeyboardScreen({ children, style, verticalOffset = 0 }) {
  // En web no hay teclado en pantalla que compensar, y KeyboardAvoidingView en
  // modo 'height' entra ahí en un bucle de medir y reajustar que congela la
  // página (lo destapó la suite e2e al abrir la hoja de reportar).
  if (Platform.OS === 'web') return <View style={[styles.flex, style]}>{children}</View>;
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={verticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
