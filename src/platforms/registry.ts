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
    id: "profiling",
    label: "Profile",
    icon: "🔍",
    component: lazy(() =>
      import("@/platforms/profiling/ProfilingPlatform").then((m) => ({ default: m.ProfilingPlatform })),
    ),
  },
  {
    id: "distribution",
    label: "Distribution",
    icon: "〰️",
    component: lazy(() =>
      import("@/platforms/eda/DistributionOverlay").then((m) => ({ default: m.DistributionOverlay })),
    ),
  },
  {
    id: "inference",
    label: "Inference",
    icon: "🧪",
    component: lazy(() =>
      import("@/platforms/inference/InferencePlatform").then((m) => ({ default: m.InferencePlatform })),
    ),
  },
  {
    id: "regression",
    label: "Regression",
    icon: "📈",
    component: lazy(() =>
      import("@/platforms/regression/RegressionPlatform").then((m) => ({ default: m.RegressionPlatform })),
    ),
  },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "🧩",
    component: lazy(() =>
      import("@/platforms/dashboard/DashboardPlatform").then((m) => ({ default: m.DashboardPlatform })),
    ),
  },
];
