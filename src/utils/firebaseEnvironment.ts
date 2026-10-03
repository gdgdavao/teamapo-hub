export const isSafeEmulatorEnvironment = (projectId: string | undefined, isProduction: boolean): boolean => {
  return !isProduction && Boolean(projectId?.startsWith('demo-'));
};
