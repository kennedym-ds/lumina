export interface PluginList {
  charts: string[];
  transforms: string[];
  tests: string[];
}

export function countPlugins(plugins?: PluginList | null): number {
  if (!plugins) {
    return 0;
  }

  return plugins.charts.length + plugins.transforms.length + plugins.tests.length;
}
