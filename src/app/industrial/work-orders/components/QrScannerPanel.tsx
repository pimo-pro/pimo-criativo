import { useCallback, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { resolveAndLoadPieceByCode } from '@/industrial/api/operatorActions';
import { useOperatorQrScanner } from '@/app/industrial/operador/hooks/useOperatorQrScanner';
import { industrialBtnStyle } from '@/industrial/ui/layouts/industrialStyles';
import { industrialUi, useIndustrialTone } from '@/industrial/ui/layouts/industrialTheme';

/**
 * Leitura QR / N-QR — input manual, câmara e USB.
 * Resolve qualquer código industrial e abre a ficha da peça.
 */
interface QrScannerPanelProps {
  onPieceScanned?: (pieceId: string) => void;
  /** Se true, cada leitura válida chama onPieceScanned e limpa o campo (leitura contínua). */
  continuous?: boolean;
}

export default function QrScannerPanel({ onPieceScanned, continuous = true }: QrScannerPanelProps) {
  const navigate = useNavigate();
  const tone = useIndustrialTone();
  const ui = industrialUi(tone);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastOk, setLastOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const lookupAndOpen = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        setError('Introduza um código N-QR, QR ou identificador da peça.');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const codes = trimmed
          .split(/[\n\r,;\t]+/)
          .map((c) => c.trim())
          .filter(Boolean);

        let opened = false;
        for (const code of codes) {
          const state = await resolveAndLoadPieceByCode(code);
          if (!state) {
            setError(`Peça não encontrada para o código "${code}".`);
            continue;
          }

          onPieceScanned?.(state.pieceId);
          setLastOk(state.etiquetaCode ?? state.pieceId);
          navigate(`/industrial/piece/${encodeURIComponent(state.pieceId)}`);
          opened = true;
          if (!continuous) break;
        }

        if (opened && continuous) setValue('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao resolver o código.');
      } finally {
        setLoading(false);
      }
    },
    [continuous, navigate, onPieceScanned],
  );

  const scanner = useOperatorQrScanner({
    enabled: scannerOpen,
    continuous,
    onScan: lookupAndOpen,
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void lookupAndOpen(value);
  };

  const toggleCamera = () => {
    if (scanner.cameraActive) {
      scanner.stopCamera();
      setScannerOpen(false);
      return;
    }
    setScannerOpen(true);
    void scanner.startCamera();
  };

  const toggleUsb = () => {
    if (scanner.usbCaptureActive) {
      scanner.stopUsbCapture();
      return;
    }
    setScannerOpen(true);
    scanner.startUsbCapture();
  };

  return (
    <section
      style={{
        border: `1px solid ${ui.panelBorder}`,
        borderRadius: 8,
        padding: 16,
        background: ui.panelBg,
        color: ui.text,
      }}
    >
      <h3 style={{ margin: '0 0 8px', fontSize: 14, color: ui.textStrong }}>Leitura N-QR / QR</h3>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: ui.muted }}>
        Introduza o N-QR, o payload do QR, o nome industrial ou o código da peça. Enter pesquisa e abre a ficha.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="N-QR / QR / nome industrial / PC-…"
          autoComplete="off"
          data-operator-usb-capture="1"
          style={{
            flex: 1,
            minWidth: 180,
            padding: '8px 10px',
            borderRadius: 6,
            border: `1px solid ${ui.inputBorder}`,
            background: ui.inputBg,
            color: ui.text,
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            border: 'none',
            background: ui.btnPrimaryBg,
            color: ui.btnPrimaryText,
            cursor: 'pointer',
          }}
        >
          {loading ? 'A ler…' : 'Ler'}
        </button>
        <button type="button" onClick={toggleCamera} style={industrialBtnStyle(scanner.cameraActive)}>
          {scanner.cameraActive ? 'Parar câmara' : 'Ler QR (câmara)'}
        </button>
        <button type="button" onClick={toggleUsb} style={industrialBtnStyle(scanner.usbCaptureActive)}>
          {scanner.usbCaptureActive ? 'USB activo' : 'Leitor USB'}
        </button>
      </form>
      {scanner.cameraActive ? (
        <div
          style={{
            marginTop: 10,
            borderRadius: 8,
            overflow: 'hidden',
            border: `1px solid ${ui.inputBorder}`,
            maxHeight: 220,
          }}
        >
          <video
            ref={scanner.videoRef}
            muted
            playsInline
            style={{ width: '100%', display: 'block', background: '#000' }}
          />
        </div>
      ) : null}
      {lastOk ? (
        <p style={{ margin: '8px 0 0', color: '#16a34a', fontSize: 12 }}>Peça: {lastOk}</p>
      ) : null}
      {error ? <p style={{ margin: '8px 0 0', color: '#dc2626', fontSize: 12 }}>{error}</p> : null}
      {scanner.error ? <p style={{ margin: '8px 0 0', color: '#dc2626', fontSize: 12 }}>{scanner.error}</p> : null}
    </section>
  );
}
