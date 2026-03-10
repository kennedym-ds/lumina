import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export interface PlatformEntry {
  id: string;
  label: string;
  icon: string;
  component: LazyExoticComponent<ComponentType>;
}

export const platforms: PlatformEntry[] = [
  {
    id: "eda",
    label: "Charts",
    icon: "📊",
    component: lazy(() => import("@/platforms/eda/EdaPlatform").then((m) => ({ default: m.EdaPlatform }))),
  },
  {
    id: "regression",
    label: "Regression",
    icon: "📈",
    component: lazy(() =>
      import("@/platforms/regression/RegressionPlatform").then((m) => ({ default: m.RegressionPlatform })),
    ),
  },
];
