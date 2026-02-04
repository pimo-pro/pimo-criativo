export type LeftToolbarItem = {
  id: string;
  label: string;
  icon: string;
  isHome?: boolean;
};

/** IDs da sidebar: nova ordem e significado. */
export const LEFT_TOOLBAR_IDS = {
  HOME: "home",
  MOVEIS: "moveis",
  MODELOS: "modelos",
  CALCULADORA: "calculadora",
  LAYOUT: "layout",
  ELETRO: "eletro",
  ACESSORIOS: "acessorios",
  INFO: "info",
} as const;

const toolbarItems: LeftToolbarItem[] = [
  { id: LEFT_TOOLBAR_IDS.HOME, label: "Início", icon: "π", isHome: true },
  { id: LEFT_TOOLBAR_IDS.MOVEIS, label: "Móveis", icon: "M" },
  { id: LEFT_TOOLBAR_IDS.MODELOS, label: "Modelos", icon: "◫" },
  { id: LEFT_TOOLBAR_IDS.CALCULADORA, label: "Calculadora", icon: "⊕" },
  { id: LEFT_TOOLBAR_IDS.LAYOUT, label: "Layout", icon: "▦" },
  { id: LEFT_TOOLBAR_IDS.ELETRO, label: "Eletro", icon: "E" },
  { id: LEFT_TOOLBAR_IDS.ACESSORIOS, label: "Acessórios", icon: "A" },
  { id: LEFT_TOOLBAR_IDS.INFO, label: "Info", icon: "?" },
];

type LeftToolbarProps = {
  selectedId: string;
  onSelect: (_id: string) => void;
};

export default function LeftToolbar({ selectedId, onSelect }: LeftToolbarProps) {
  const handleHomeClick = () => {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    onSelect(LEFT_TOOLBAR_IDS.HOME);
  };

  return (
    <aside className="left-toolbar" aria-label="Navegação lateral">
      {toolbarItems.map((item) => {
        const isSelected = selectedId === item.id;
        if (item.isHome) {
          return (
            <button
              key={item.id}
              type="button"
              className={`left-toolbar-item ${isSelected ? "left-toolbar-item--selected" : ""}`}
              onClick={handleHomeClick}
              title={item.label}
              aria-label={item.label}
            >
              <span className="left-toolbar-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="left-toolbar-label">{item.label}</span>
            </button>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            className={`left-toolbar-item ${isSelected ? "left-toolbar-item--selected" : ""}`}
            onClick={() => onSelect(item.id)}
            title={item.label}
            aria-label={item.label}
          >
            <span className="left-toolbar-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="left-toolbar-label">{item.label}</span>
          </button>
        );
      })}
    </aside>
  );
}
