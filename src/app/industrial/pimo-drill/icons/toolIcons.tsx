import type { CSSProperties, ReactNode } from 'react';

import type { PimoDrillToolId } from '../pimoDrillTypes';

type IconProps = { size?: number; style?: CSSProperties };

function SvgShell({ size = 18, style, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function View2DIcon(props: IconProps) {
  return (
    <SvgShell {...props}>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M4 12h16M12 4v16" opacity="0.5" />
    </SvgShell>
  );
}

export function View3DIcon(props: IconProps) {
  return (
    <SvgShell {...props}>
      <path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z" />
      <path d="M12 12v9M12 12 20 7.5M12 12 4 7.5" />
    </SvgShell>
  );
}

export function HoleIcon(props: IconProps) {
  return (
    <SvgShell {...props}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" />
    </SvgShell>
  );
}

export function SlotIcon(props: IconProps) {
  return (
    <SvgShell {...props}>
      <rect x="4" y="9" width="16" height="6" rx="3" />
    </SvgShell>
  );
}

export function RectIcon(props: IconProps) {
  return (
    <SvgShell {...props}>
      <rect x="5" y="5" width="14" height="14" rx="1" />
    </SvgShell>
  );
}

export function CircleIcon(props: IconProps) {
  return (
    <SvgShell {...props}>
      <circle cx="12" cy="12" r="8" />
    </SvgShell>
  );
}

export function ArcIcon(props: IconProps) {
  return (
    <SvgShell {...props}>
      <path d="M5 16a8 8 0 0 1 14 0" />
      <path d="M5 16h2M17 16h2" />
    </SvgShell>
  );
}

export function PathIcon(props: IconProps) {
  return (
    <SvgShell {...props}>
      <path d="M4 16 9 8l4 5 3-4 4 7" />
    </SvgShell>
  );
}

export const TOOL_ICONS: Record<PimoDrillToolId, (props: IconProps) => ReactNode> = {
  '2d': View2DIcon,
  '3d': View3DIcon,
  hole: HoleIcon,
  slot: SlotIcon,
  rect: RectIcon,
  circle: CircleIcon,
  arc: ArcIcon,
  path: PathIcon,
};
