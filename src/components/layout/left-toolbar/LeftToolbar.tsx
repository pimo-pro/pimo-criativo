type LeftToolbarItem = {
  id: string;
  label: string;
  icon: string;
};

const toolbarItems: LeftToolbarItem[] = [
  { id: "home", label: "HOME", icon: "H" },
  { id: "moveis", label: "Móveis", icon: "M" },
  { id: "caixa", label: "Caixa", icon: "C" },
  { id: "calculadora", label: "Calculadora", icon: "K" },
  { id: "layout", label: "Layout", icon: "L" },
  { id: "cores", label: "Cores", icon: "Co" },
  { id: "eletro", label: "Eletrodomésticos", icon: "E" },
  { id: "acessorios", label: "Acessórios", icon: "A" },
  { id: "thema", label: "Thema", icon: "T" },
  { id: "info", label: "Info", icon: "I" },
];

type LeftToolbarProps = {
  onSelect: () => void;
};

export default function LeftToolbar({ onSelect }: LeftToolbarProps) {
  return (
    <aside className="left-toolbar" aria-label="Ferramentas rápidas">
      {toolbarItems.map((item) => (
        <button key={item.id} type="button" className="left-toolbar-item" onClick={onSelect}>
          <span className="left-toolbar-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="left-toolbar-label">{item.label}</span>
        </button>
      ))}
    </aside>
  );
}
