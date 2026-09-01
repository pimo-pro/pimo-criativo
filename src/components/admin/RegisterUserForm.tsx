import { useMemo, useState } from "react";

import Button from "../ui/Button";
import FormGroup from "../ui/FormGroup";
import Input from "../ui/Input";
import Section from "../ui/Section";
import "../ui/ui.css";

/** Categoria de negócio (independente da role RBAC). */
// eslint-disable-next-line react-refresh/only-export-components
export type AccountCategory =
  | "visitor"
  | "designer_arquiteto"
  | "lojista"
  | "fabricante";

// eslint-disable-next-line react-refresh/only-export-components
export const ACCOUNT_CATEGORY_OPTIONS: readonly {
  value: AccountCategory;
  label: string;
}[] = [
  { value: "visitor", label: "Visitor" },
  { value: "designer_arquiteto", label: "Designer/Arquiteto" },
  { value: "lojista", label: "Lojista" },
  { value: "fabricante", label: "Fabricante" },
];

/** Role pública enviada ao servidor — mesmo contrato de sempre (visitor|pro). */
// eslint-disable-next-line react-refresh/only-export-components
export type RegisterPublicRole = "visitor" | "pro";

// eslint-disable-next-line react-refresh/only-export-components
export function mapAccountCategoryToPublicRole(
  category: AccountCategory
): RegisterPublicRole {
  return category === "visitor" ? "visitor" : "pro";
}

export type RegisterFormValues = {
  nome: string;
  sobrenome: string;
  email: string;
  pais: string;
  telefone: string;
  numeroFiscal: string;
  cep: string;
  cidade: string;
  endereco: string;
  accountCategory: AccountCategory;
  username: string;
  senha: string;
  confirmarSenha: string;
  codigoConvite: string;
  captchaOk: boolean;
};

type Props = {
  submitLabel: string;
  onSubmit: (_values: RegisterFormValues) => Promise<void> | void;
  initialValues?: Partial<RegisterFormValues>;
  compact?: boolean;
};

type CountryConfig = {
  value: string;
  label: string;
};

const COUNTRIES: CountryConfig[] = [
  { value: "AF", label: "Afeganistão" }, { value: "ZA", label: "África do Sul" }, { value: "AL", label: "Albânia" },
  { value: "DE", label: "Alemanha" }, { value: "AD", label: "Andorra" }, { value: "AO", label: "Angola" },
  { value: "AG", label: "Antígua e Barbuda" }, { value: "SA", label: "Arábia Saudita" }, { value: "DZ", label: "Argélia" },
  { value: "AR", label: "Argentina" }, { value: "AM", label: "Armênia" }, { value: "AU", label: "Austrália" },
  { value: "AT", label: "Áustria" }, { value: "AZ", label: "Azerbaijão" }, { value: "BS", label: "Bahamas" },
  { value: "BH", label: "Bahrein" }, { value: "BD", label: "Bangladesh" }, { value: "BB", label: "Barbados" },
  { value: "BE", label: "Bélgica" }, { value: "BZ", label: "Belize" }, { value: "BJ", label: "Benim" },
  { value: "BT", label: "Butão" }, { value: "BO", label: "Bolívia" }, { value: "BA", label: "Bósnia e Herzegovina" },
  { value: "BW", label: "Botsuana" }, { value: "BR", label: "Brasil" }, { value: "BN", label: "Brunei" },
  { value: "BG", label: "Bulgária" }, { value: "BF", label: "Burkina Faso" }, { value: "BI", label: "Burundi" },
  { value: "CV", label: "Cabo Verde" }, { value: "CM", label: "Camarões" }, { value: "KH", label: "Camboja" },
  { value: "CA", label: "Canadá" }, { value: "QA", label: "Catar" }, { value: "KZ", label: "Cazaquistão" },
  { value: "TD", label: "Chade" }, { value: "CL", label: "Chile" }, { value: "CN", label: "China" },
  { value: "CY", label: "Chipre" }, { value: "CO", label: "Colômbia" }, { value: "KM", label: "Comores" },
  { value: "CG", label: "Congo" }, { value: "KR", label: "Coreia do Sul" }, { value: "KP", label: "Coreia do Norte" },
  { value: "CI", label: "Costa do Marfim" }, { value: "CR", label: "Costa Rica" }, { value: "HR", label: "Croácia" },
  { value: "CU", label: "Cuba" }, { value: "DK", label: "Dinamarca" }, { value: "DJ", label: "Djibuti" },
  { value: "DM", label: "Dominica" }, { value: "EG", label: "Egito" }, { value: "SV", label: "El Salvador" },
  { value: "AE", label: "Emirados Árabes Unidos" }, { value: "EC", label: "Equador" }, { value: "ER", label: "Eritreia" },
  { value: "SK", label: "Eslováquia" }, { value: "SI", label: "Eslovênia" }, { value: "ES", label: "Espanha" },
  { value: "US", label: "Estados Unidos" }, { value: "EE", label: "Estônia" }, { value: "ET", label: "Etiópia" },
  { value: "PH", label: "Filipinas" }, { value: "FI", label: "Finlândia" }, { value: "FR", label: "França" },
  { value: "GA", label: "Gabão" }, { value: "GM", label: "Gâmbia" }, { value: "GH", label: "Gana" },
  { value: "GE", label: "Geórgia" }, { value: "GD", label: "Granada" }, { value: "GR", label: "Grécia" },
  { value: "GT", label: "Guatemala" }, { value: "GN", label: "Guiné" }, { value: "GW", label: "Guiné-Bissau" },
  { value: "GQ", label: "Guiné Equatorial" }, { value: "GY", label: "Guiana" }, { value: "HT", label: "Haiti" },
  { value: "HN", label: "Honduras" }, { value: "HU", label: "Hungria" }, { value: "YE", label: "Iêmen" },
  { value: "IN", label: "Índia" }, { value: "ID", label: "Indonésia" }, { value: "IR", label: "Irã" },
  { value: "IQ", label: "Iraque" }, { value: "IE", label: "Irlanda" }, { value: "IS", label: "Islândia" },
  { value: "IL", label: "Israel" }, { value: "IT", label: "Itália" }, { value: "JM", label: "Jamaica" },
  { value: "JP", label: "Japão" }, { value: "JO", label: "Jordânia" }, { value: "KW", label: "Kuwait" },
  { value: "LA", label: "Laos" }, { value: "LS", label: "Lesoto" }, { value: "LV", label: "Letônia" },
  { value: "LB", label: "Líbano" }, { value: "LR", label: "Libéria" }, { value: "LY", label: "Líbia" },
  { value: "LI", label: "Liechtenstein" }, { value: "LT", label: "Lituânia" }, { value: "LU", label: "Luxemburgo" },
  { value: "MG", label: "Madagascar" }, { value: "MY", label: "Malásia" }, { value: "MW", label: "Malawi" },
  { value: "MV", label: "Maldivas" }, { value: "ML", label: "Mali" }, { value: "MT", label: "Malta" },
  { value: "MA", label: "Marrocos" }, { value: "MU", label: "Maurício" }, { value: "MR", label: "Mauritânia" },
  { value: "MX", label: "México" }, { value: "MZ", label: "Moçambique" }, { value: "MD", label: "Moldávia" },
  { value: "MC", label: "Mônaco" }, { value: "MN", label: "Mongólia" }, { value: "ME", label: "Montenegro" },
  { value: "NA", label: "Namíbia" }, { value: "NP", label: "Nepal" }, { value: "NI", label: "Nicarágua" },
  { value: "NE", label: "Níger" }, { value: "NG", label: "Nigéria" }, { value: "NO", label: "Noruega" },
  { value: "NZ", label: "Nova Zelândia" }, { value: "OM", label: "Omã" }, { value: "NL", label: "Países Baixos" },
  { value: "PA", label: "Panamá" }, { value: "PG", label: "Papua-Nova Guiné" }, { value: "PK", label: "Paquistão" },
  { value: "PY", label: "Paraguai" }, { value: "PE", label: "Peru" }, { value: "PL", label: "Polônia" },
  { value: "PT", label: "Portugal" }, { value: "KE", label: "Quênia" }, { value: "KG", label: "Quirguistão" },
  { value: "GB", label: "Reino Unido" }, { value: "CZ", label: "República Tcheca" }, { value: "CD", label: "República Democrática do Congo" },
  { value: "DO", label: "República Dominicana" }, { value: "RO", label: "Romênia" }, { value: "RW", label: "Ruanda" },
  { value: "RU", label: "Rússia" }, { value: "SM", label: "San Marino" }, { value: "ST", label: "São Tomé e Príncipe" },
  { value: "SN", label: "Senegal" }, { value: "RS", label: "Sérvia" }, { value: "SC", label: "Seychelles" },
  { value: "SG", label: "Singapura" }, { value: "SY", label: "Síria" }, { value: "SO", label: "Somália" },
  { value: "LK", label: "Sri Lanka" }, { value: "SD", label: "Sudão" }, { value: "SE", label: "Suécia" },
  { value: "CH", label: "Suíça" }, { value: "TH", label: "Tailândia" }, { value: "TW", label: "Taiwan" },
  { value: "TZ", label: "Tanzânia" }, { value: "TL", label: "Timor-Leste" }, { value: "TG", label: "Togo" },
  { value: "TN", label: "Tunísia" }, { value: "TR", label: "Turquia" }, { value: "UA", label: "Ucrânia" },
  { value: "UG", label: "Uganda" }, { value: "UY", label: "Uruguai" }, { value: "UZ", label: "Uzbequistão" },
  { value: "VE", label: "Venezuela" }, { value: "VN", label: "Vietnã" }, { value: "ZM", label: "Zâmbia" },
  { value: "ZW", label: "Zimbábue" }
];

const COUNTRY_PHONE_PREFIX: Record<string, string> = {
  AF: "+93", ZA: "+27", AL: "+355", DE: "+49", AD: "+376", AO: "+244", AG: "+1",
  SA: "+966", DZ: "+213", AR: "+54", AM: "+374", AU: "+61", AT: "+43", AZ: "+994",
  BS: "+1", BH: "+973", BD: "+880", BB: "+1", BE: "+32", BZ: "+501", BJ: "+229",
  BT: "+975", BO: "+591", BA: "+387", BW: "+267", BR: "+55", BN: "+673", BG: "+359",
  BF: "+226", BI: "+257", CV: "+238", CM: "+237", KH: "+855", CA: "+1", QA: "+974",
  KZ: "+7", TD: "+235", CL: "+56", CN: "+86", CY: "+357", CO: "+57", KM: "+269",
  CG: "+242", KR: "+82", KP: "+850", CI: "+225", CR: "+506", HR: "+385", CU: "+53",
  DK: "+45", DJ: "+253", DM: "+1", EG: "+20", SV: "+503", AE: "+971", EC: "+593",
  ER: "+291", SK: "+421", SI: "+386", ES: "+34", US: "+1", EE: "+372", ET: "+251",
  PH: "+63", FI: "+358", FR: "+33", GA: "+241", GM: "+220", GH: "+233", GE: "+995",
  GD: "+1", GR: "+30", GT: "+502", GN: "+224", GW: "+245", GQ: "+240", GY: "+592",
  HT: "+509", HN: "+504", HU: "+36", YE: "+967", IN: "+91", ID: "+62", IR: "+98",
  IQ: "+964", IE: "+353", IS: "+354", IL: "+972", IT: "+39", JM: "+1", JP: "+81",
  JO: "+962", KW: "+965", LA: "+856", LS: "+266", LV: "+371", LB: "+961", LR: "+231",
  LY: "+218", LI: "+423", LT: "+370", LU: "+352", MG: "+261", MY: "+60", MW: "+265",
  MV: "+960", ML: "+223", MT: "+356", MA: "+212", MU: "+230", MR: "+222", MX: "+52",
  MZ: "+258", MD: "+373", MC: "+377", MN: "+976", ME: "+382", NA: "+264", NP: "+977",
  NI: "+505", NE: "+227", NG: "+234", NO: "+47", NZ: "+64", OM: "+968", NL: "+31",
  PA: "+507", PG: "+675", PK: "+92", PY: "+595", PE: "+51", PL: "+48", PT: "+351",
  KE: "+254", KG: "+996", GB: "+44", CZ: "+420", CD: "+243", DO: "+1", RO: "+40",
  RW: "+250", RU: "+7", SM: "+378", ST: "+239", SN: "+221", RS: "+381", SC: "+248",
  SG: "+65", SY: "+963", SO: "+252", LK: "+94", SD: "+249", SE: "+46", CH: "+41",
  TH: "+66", TW: "+886", TZ: "+255", TL: "+670", TG: "+228", TN: "+216", TR: "+90",
  UA: "+380", UG: "+256", UY: "+598", UZ: "+998", VE: "+58", VN: "+84", ZM: "+260",
  ZW: "+263",
};

const FISCAL_LABEL_BY_COUNTRY: Record<string, string> = {
  PT: "NIF",
  BR: "CPF/CNPJ",
  ES: "NIF/NIE",
  US: "Tax ID",
};

const DEFAULT_VALUES: RegisterFormValues = {
  nome: "",
  sobrenome: "",
  email: "",
  pais: "PT",
  telefone: "+351 ",
  numeroFiscal: "",
  cep: "",
  cidade: "",
  endereco: "",
  accountCategory: "visitor",
  username: "",
  senha: "",
  confirmarSenha: "",
  codigoConvite: "",
  captchaOk: false,
};

function slugifyUsername(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function buildSuggestedUsername(nome: string, sobrenome: string): string {
  const full = `${nome} ${sobrenome}`.trim();
  const slug = slugifyUsername(full);
  return slug || "novo.utilizador";
}

function getFiscalLabel(countryCode: string): string {
  return FISCAL_LABEL_BY_COUNTRY[countryCode] ?? "Número Fiscal";
}

function getPhonePrefix(countryCode: string): string {
  return COUNTRY_PHONE_PREFIX[countryCode] ?? "+1";
}

function prepareAddressAutocomplete(_value: string): void {
  // Preparado para integração futura com auto-complete de endereço.
}

export default function RegisterUserForm({
  submitLabel,
  onSubmit,
  initialValues,
  compact = false,
}: Props) {
  const [values, setValues] = useState<RegisterFormValues>({
    ...DEFAULT_VALUES,
    ...initialValues,
    telefone:
      initialValues?.telefone ??
      getPhonePrefix(initialValues?.pais ?? DEFAULT_VALUES.pais).concat(" ") ??
      DEFAULT_VALUES.telefone,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const usernameEdited = Boolean(initialValues?.username);

  const fiscalLabel = useMemo(() => getFiscalLabel(values.pais), [values.pais]);

  const updateValue = (field: keyof RegisterFormValues, next: string | boolean) => {
    setValues((current) => ({ ...current, [field]: next }));
    setErrors((current) => {
      const clone = { ...current };
      delete clone[field];
      return clone;
    });
  };

  const handleNameChange = (field: "nome" | "sobrenome", next: string) => {
    setValues((current) => {
      const updated = { ...current, [field]: next };
      if (!usernameEdited) {
        updated.username = buildSuggestedUsername(updated.nome, updated.sobrenome);
      }
      return updated;
    });
  };

  const handleCountryChange = (countryCode: string) => {
    const prefix = getPhonePrefix(countryCode);
    setValues((current) => {
      const sanitizedPhone = current.telefone.replace(/^\+\d+\s?/, "").trim();
      return {
        ...current,
        pais: countryCode,
        telefone: `${prefix} ${sanitizedPhone}`.trim(),
      };
    });
  };

  const validate = (): Record<string, string> => {
    const nextErrors: Record<string, string> = {};
    const requiredFields: Array<keyof RegisterFormValues> = [
      "nome",
      "sobrenome",
      "email",
      "pais",
      "telefone",
      "numeroFiscal",
      "cep",
      "cidade",
      "endereco",
      "accountCategory",
      "username",
      "senha",
      "confirmarSenha",
    ];

    requiredFields.forEach((field) => {
      if (!String(values[field]).trim()) {
        nextErrors[field] = "Campo obrigatório";
      }
    });

    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      nextErrors.email = "Email inválido";
    }

    if (!ACCOUNT_CATEGORY_OPTIONS.some((o) => o.value === values.accountCategory)) {
      nextErrors.accountCategory = "Tipo de conta inválido";
    }

    if (values.senha && values.senha.length < 6) {
      nextErrors.senha = "A senha deve ter pelo menos 6 caracteres";
    }

    if (values.senha !== values.confirmarSenha) {
      nextErrors.confirmarSenha = "As senhas não coincidem";
    }

    if (!values.captchaOk) {
      nextErrors.captchaOk = "Confirme a verificação humana";
    }

    return nextErrors;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Falha no envio");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="ui-form-group">
      <div className={compact ? "ui-grid ui-grid--1" : "ui-register-main-grid"}>
        <Input
          label="Nome"
          value={values.nome}
          onChange={(event) => handleNameChange("nome", event.target.value)}
          error={errors.nome}
          required
        />
        <Input
          label="Sobrenome"
          value={values.sobrenome}
          onChange={(event) => handleNameChange("sobrenome", event.target.value)}
          error={errors.sobrenome}
          required
        />

        <Input
          type="email"
          label="Email"
          value={values.email}
          onChange={(event) => updateValue("email", event.target.value)}
          error={errors.email}
          required
        />
        <FormGroup>
          <span className="ui-input__label">Tipo de conta</span>
          <select
            className="ui-input"
            value={values.accountCategory}
            onChange={(event) =>
              updateValue("accountCategory", event.target.value as AccountCategory)
            }
            required
          >
            {ACCOUNT_CATEGORY_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {errors.accountCategory ? (
            <span className="ui-input__error">{errors.accountCategory}</span>
          ) : null}
        </FormGroup>

        <FormGroup>
          <span className="ui-input__label">País</span>
          <select
            className="ui-input"
            value={values.pais}
            onChange={(event) => handleCountryChange(event.target.value)}
            required
          >
            {COUNTRIES.map((country) => (
              <option key={country.value} value={country.value}>
                {country.label}
              </option>
            ))}
          </select>
          {errors.pais ? <span className="ui-input__error">{errors.pais}</span> : null}
        </FormGroup>
        <Input
          label="Telefone"
          value={values.telefone}
          onChange={(event) => updateValue("telefone", event.target.value)}
          error={errors.telefone}
          required
        />

        <Input
          label="Cidade"
          value={values.cidade}
          onChange={(event) => updateValue("cidade", event.target.value)}
          error={errors.cidade}
          required
        />
        <Input
          label="Endereço"
          value={values.endereco}
          onFocus={() => prepareAddressAutocomplete(values.endereco)}
          onChange={(event) => updateValue("endereco", event.target.value)}
          error={errors.endereco}
          required
        />

        <Input
          label="CEP / Código Postal"
          value={values.cep}
          onChange={(event) => updateValue("cep", event.target.value)}
          error={errors.cep}
          required
        />
        <Input
          label={fiscalLabel}
          value={values.numeroFiscal}
          onChange={(event) => updateValue("numeroFiscal", event.target.value)}
          error={errors.numeroFiscal}
          required
        />
      </div>

      <Section title="Segurança e confirmação" className="ui-register-fields">
        <div className="ui-register-security-grid">
          <Input
            type="password"
            label="Confirmar senha"
            value={values.confirmarSenha}
            onChange={(event) => updateValue("confirmarSenha", event.target.value)}
            error={errors.confirmarSenha}
            required
          />
          <Input
            type="password"
            label="Senha"
            value={values.senha}
            onChange={(event) => updateValue("senha", event.target.value)}
            error={errors.senha}
            required
          />
          <label className="ui-checkbox-line">
            <input
              type="checkbox"
              checked={values.captchaOk}
              onChange={(event) => updateValue("captchaOk", event.target.checked)}
            />
            <span>Não sou um robô</span>
          </label>
          <Input
            label="Código de convite"
            value={values.codigoConvite}
            onChange={(event) => updateValue("codigoConvite", event.target.value)}
            placeholder="Opcional — validado no servidor"
          />
        </div>

        {errors.captchaOk ? <span className="ui-input__error">{errors.captchaOk}</span> : null}

        <input
          type="text"
          value={values.username}
          onChange={(event) => updateValue("username", event.target.value)}
          autoComplete="off"
          tabIndex={-1}
          aria-hidden="true"
          className="ui-register-hidden-field"
        />

        <div className="ui-register-submit">
          {statusMessage ? <p className="ui-text-danger">{statusMessage}</p> : null}
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Enviando..." : submitLabel}
          </Button>
        </div>
      </Section>

    </form>
  );
}
