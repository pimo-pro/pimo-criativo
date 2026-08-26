/**
 * Campo texto livre com sugestões (catálogo / projecto) — padrão Portas + datalist.
 */
import { reportInput } from "../reportStyles";

type Props = {
  value: string;
  listId: string;
  options: readonly string[];
  title?: string;
  placeholder?: string;
  minWidth?: number;
  onChange: (value: string) => void;
};

export default function ReportCatalogOrManualField({
  value,
  listId,
  options,
  title,
  placeholder,
  minWidth = 140,
  onChange,
}: Props) {
  const unique = [...new Set(options.map((o) => o.trim()).filter(Boolean))];
  return (
    <>
      <input
        style={{ ...reportInput, minHeight: 32, minWidth }}
        list={listId}
        value={value}
        title={title}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {unique.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </>
  );
}
