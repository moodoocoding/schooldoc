export const isRegistryDemoMode = (
  import.meta.env.DEV
  && import.meta.env.VITE_REGISTRY_DEMO_MODE === 'true'
);
