// Public entry of src/builder — owned by T13. Contract C09. No React.
export { applyBuilderAction } from './apply';
export { placeholderName, isPlaceholderName } from './names';
export { pickRejection } from './pick';
export { MSG as BUILDER_MESSAGES, MESSAGES as BUILDER_MESSAGES_BY_LOCALE } from './types';
export type {
  AttributeSpec,
  DomainSpec,
  GeneralConstraintSpec,
  BuilderAction,
  BuilderOptions,
  BuilderResult,
  NewObject,
  PickPurpose,
  PlaceholderKind,
  Placement,
} from './types';
