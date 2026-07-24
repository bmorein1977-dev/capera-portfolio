import mammoth from 'mammoth';

export interface ExtractedDocument {
  // "text": plain extractable text was found (docx/pdf/txt)
  // "image": no text extraction attempted - the raw bytes should be sent to Claude as an image instead
  // "unsupported": neither text nor image handling applies (e.g. video) - caller should fall back to filename-only context
  kind: 'text' | 'image' | 'unsupported';
  text?: string;
  imageMediaType?: string;
}

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']);

/**
 * Extracts reviewable content from an uploaded evidence file so it can be handed to Claude.
 * DOCX and PDF are converted to plain text; images are flagged for direct vision input instead
 * (Claude can read a photo of a nameplate or sign-off sheet far better than any OCR text dump);
 * everything else falls back to filename-only review.
 */
export async function extractDocumentContent(buffer: Buffer, mimeType: string | null | undefined): Promise<ExtractedDocument> {
  const mime = (mimeType || '').toLowerCase();

  if (IMAGE_MIME_TYPES.has(mime)) {
    return { kind: 'image', imageMediaType: mime === 'image/jpg' ? 'image/jpeg' : mime };
  }

  if (mime === 'application/pdf') {
    let parser: import('pdf-parse').PDFParse | undefined;
    try {
      const { PDFParse } = await import('pdf-parse');
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return { kind: 'text', text: result.text };
    } catch (error) {
      console.error('PDF text extraction failed:', error);
      return { kind: 'unsupported' };
    } finally {
      await parser?.destroy();
    }
  }

  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/msword'
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return { kind: 'text', text: result.value };
    } catch (error) {
      console.error('DOCX text extraction failed:', error);
      return { kind: 'unsupported' };
    }
  }

  if (mime.startsWith('text/')) {
    return { kind: 'text', text: buffer.toString('utf-8') };
  }

  return { kind: 'unsupported' };
}
