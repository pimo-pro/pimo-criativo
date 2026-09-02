import type { FC } from "react";
import type { IconProps } from "../types";

/** Vistas da câmara — corpo de câmara (presets), distinto do Photo Mode. */
export const IconCamera: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <path d="M3 8h13v11H3z" />
    <path d="M16 11.5 21 8.5v10l-5-3z" />
    <circle cx="9.5" cy="13.5" r="2.25" />
    <path d="M7 8V6h6v2" />
  </svg>
);

/** Highlight — brilho de selecção. */
export const IconHighlight: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2.5M12 18v2.5M3.5 12h2.5M18 12h2.5" />
    <path d="M6.4 6.4l1.8 1.8M15.8 15.8l1.8 1.8M17.6 6.4l-1.8 1.8M8.2 15.8l-1.8 1.8" />
  </svg>
);

/** Régua — caminhos extraídos da toolbar do Viewer. */
export const IconRuler: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <path d="M4 12h16" />
    <path d="M5 14v-4M8 14v-4M11 14v-2M14 14v-4M17 14v-4M20 14v-4" />
  </svg>
);

/** Grelha 2×2 — inspirado na grelha de BottomInfoToolbar (fill + opacidade). */
export const IconGrid: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 14 14"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <rect x="1" y="1" width="5" height="5" rx="1" fill={color} opacity="0.9" />
    <rect x="8" y="1" width="5" height="5" rx="1" fill={color} opacity="0.65" />
    <rect x="1" y="8" width="5" height="5" rx="1" fill={color} opacity="0.65" />
    <rect x="8" y="8" width="5" height="5" rx="1" fill={color} opacity="0.9" />
  </svg>
);

/** Planta de sala isométrica. */
export const IconRoom: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <path d="M4 18V9l8-4.5L20 9v9" />
    <path d="M4 9l8 4.5L20 9" />
    <path d="M12 13.5V21" />
    <path d="M4 18h16" />
  </svg>
);

export const IconOrbit: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <path d="M12 5a7 7 0 1 1-6.3 4" />
    <path d="M6 4v4h4" />
  </svg>
);

export const IconPan: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <path d="M12 5v3M12 16v3M5 12h3M16 12h3" />
    <path d="M12 5l-2 2M12 5l2 2M12 19l-2-2M12 19l2-2M5 12l2-2M5 12l2 2M19 12l-2-2M19 12l2 2" />
  </svg>
);

export const IconSelect: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <path d="M4 4l7 18 2-8 8-2L4 4z" />
  </svg>
);

export const IconMove: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <path d="M12 5v3M12 16v3M5 12h3M16 12h3" />
    <path d="M12 5l-2 2M12 5l2 2M12 19l-2-2M12 19l2-2M5 12l2-2M5 12l2 2M19 12l-2-2M19 12l2-2" />
    <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
  </svg>
);

export const IconRotate: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <path d="M12 5a7 7 0 1 1-1 13.9" />
    <path d="M12 5V2l3 3-3 3" />
  </svg>
);

export const IconScale: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <path d="M15 3h6v6" />
    <path d="M21 3l-7 7" />
    <path d="M9 21H3v-6" />
    <path d="M3 21l7-7" />
  </svg>
);

/** Peças individuais — três painéis. */
export const IconPieces: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <path d="M5 6h3.5v12H5z" />
    <path d="M10.25 4h3.5v16h-3.5z" />
    <path d="M15.5 7h3.5v10H15.5z" />
  </svg>
);

/** Medidas do conjunto — caixa com cotas. */
export const IconDimensions: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <path d="M8 8h10v10H8z" />
    <path d="M8 4.5h10M8 3.5v2M18 3.5v2" />
    <path d="M4.5 8v10M3.5 8h2M3.5 18h2" />
  </svg>
);

/** Design Industrial — cubo com furo. */
export const IconIndustrialDesign: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5z" />
    <path d="M12 3.5V12" />
    <path d="M4 8l8 4 8-4" />
    <circle cx="12" cy="16" r="2" />
  </svg>
);

/** Íman / snap de aberturas na parede (pimo-room). */
export const IconRoomSnap: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <path d="M7 8V6a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v8a3 3 0 0 0 6 0V9" />
    <path d="M7 12v2a3 3 0 0 0 3 3h0" />
    <path d="M3 12h4" />
  </svg>
);

/** Porta esquemática (pimo-room). */
export const IconRoomDoor: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <rect x="6" y="3" width="12" height="18" rx="1" />
    <circle cx="15" cy="12" r="0.9" fill={color} stroke="none" />
  </svg>
);

/** Janela esquemática (pimo-room). */
export const IconRoomWindow: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <rect x="4" y="5" width="16" height="14" rx="1" />
    <path d="M12 5v14" />
    <path d="M4 12h16" />
  </svg>
);

/** Vértice / comprimento de parede (pimo-room). */
export const IconRoomVertex: FC<IconProps> = ({
  size,
  color = "currentColor",
  className,
  "aria-hidden": ariaHidden = true,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
  >
    {title ? <title>{title}</title> : null}
    <path d="M4 18h16" />
    <circle cx="4" cy="18" r="2" />
    <circle cx="20" cy="18" r="2" />
    <path d="M4 18 12 6l8 12" />
  </svg>
);
