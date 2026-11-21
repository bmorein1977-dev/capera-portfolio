import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, Download, ExternalLink } from 'lucide-react';
import { useLicence } from '@/hooks/useAuth';
import { tierForPath, tierIncludes } from '@shared/licence';

// Encodes the address a phone camera opens: /check/<id>. The scanner signs in (and is sent straight back), then sees the full training and
// competence check if they are a checker, or only a name, photo and tick if not. The person's own id is the identifier, so the code needs no
// new field and nothing in it reveals anything by itself.
export function CompetenceBadgeQr({ userId, userName }: { userId: string; userName: string }) {
  const licence = useLicence();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const badgeUrl = `${window.location.origin}/check/${encodeURIComponent(userId)}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(badgeUrl, { width: 220, margin: 1 })
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch(() => { if (!cancelled) setDataUrl(null); });
    return () => { cancelled = true; };
  }, [badgeUrl]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${userName.replace(/\s+/g, '-').toLowerCase()}-competence-badge.png`;
    a.click();
  };

  // the check a scan opens is a Gold feature, so below Gold there is no code to show
  if (!tierIncludes(licence, tierForPath("/check/x"))) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><QrCode className="h-4 w-4" /> Competence Badge</CardTitle>
        <CardDescription>Scan with a phone to check live training and competence (the scanner signs in)</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        {dataUrl ? (
          <img src={dataUrl} alt="Competence badge QR code" className="rounded border" data-testid="img-badge-qr" width={220} height={220} />
        ) : (
          <div className="h-[220px] w-[220px] flex items-center justify-center border rounded text-muted-foreground text-sm">Generating...</div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={!dataUrl} data-testid="button-download-badge-qr">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(badgeUrl, '_blank')} data-testid="button-open-badge">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Badge
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
