// Barril de componentes base del sistema de diseño (docs/design-system.md
// §5). Las pantallas rediseñadas importan desde aquí, no de cada archivo:
//   import { Screen, Text, Button } from '../ui';
export { default as Screen } from './Screen';
export { default as Text } from './Text';
export { default as Button } from './Button';
export { default as ListSection } from './ListSection';
export { default as ListRow } from './ListRow';
export { default as Card } from './Card';
export { default as SegmentedControl } from './SegmentedControl';
export { default as SearchField } from './SearchField';
export { TextField, TextArea } from './TextField';
export { default as Chip } from './Chip';
export { default as EmptyState } from './EmptyState';
export { default as Icon } from './Icon';
export * as haptics from './haptics';
