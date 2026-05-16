/**
 * @deprecated — prefer atoms from `./Skeletons` (e.g. `SkeletonBox`).
 * Kept as a thin re-export so existing callers (`<Skeleton width={…} />`)
 * keep working while we migrate the rest of the codebase.
 */
export { SkeletonBox as Skeleton } from "./Skeletons";
export * from "./Skeletons";
