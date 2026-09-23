import JournalListScreen from '../../screens/journal/JournalListScreen';
import JournalEditorScreen from '../../screens/journal/JournalEditorScreen';
import JournalEntryScreen from '../../screens/journal/JournalEntryScreen';

/**
 * Pantallas del módulo "diary" que viven en el stack raíz (encima de las
 * pestañas). AppNavigator las registra todas; así cada módulo agrega sus
 * pantallas sin editar AppNavigator.
 *
 *   Journal         lista del diario libre (agrupada por fecha, búsqueda)
 *   JournalEditor   { id?, promptKey? } — nueva entrada o editar una existente
 *   JournalEntry    { id } — detalle, editar y borrar
 */
export const DIARY_ROUTES = [
  { name: 'Journal', component: JournalListScreen, options: {} },
  { name: 'JournalEditor', component: JournalEditorScreen, options: {} },
  { name: 'JournalEntry', component: JournalEntryScreen, options: {} },
];
