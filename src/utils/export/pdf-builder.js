// PDF Builder — helper per costruire PDF con page break automatici e sezioni riutilizzabili
import { jsPDF } from 'jspdf';
import { docHeading, docLabel } from './doc-labels.js';

const MARGIN = 20;
const PAGE_BOTTOM = 270;
const PAGE_TOP = 20;
const ACCENT_COLOR = [102, 126, 234];

export class PDFBuilder {
  constructor() {
    this.doc = new jsPDF();
    this.y = PAGE_TOP;
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.maxWidth = this.pageWidth - MARGIN * 2;
  }

  // ===== Primitives =====

  checkPageBreak(threshold = PAGE_BOTTOM) {
    if (this.y > threshold) {
      this.doc.addPage();
      this.y = PAGE_TOP;
    }
  }

  writeText(text, { fontSize = 10, style = 'normal', color = [0, 0, 0], indent = 0 } = {}) {
    this.doc.setFontSize(fontSize);
    this.doc.setFont(undefined, style);
    this.doc.setTextColor(...color);
    const lines = this.doc.splitTextToSize(text, this.maxWidth - indent);
    for (const line of lines) {
      this.checkPageBreak();
      this.doc.text(line, MARGIN + indent, this.y);
      this.y += fontSize * 0.5;
    }
  }

  writeSectionTitle(title) {
    this.checkPageBreak(250);
    this.doc.setFontSize(14);
    this.doc.setFont(undefined, 'bold');
    this.doc.setTextColor(0);
    this.doc.text(title, MARGIN, this.y);
    this.y += 10;
  }

  writeTextBlock(text, { fontSize = 10, indent = 0, lineHeight = 5 } = {}) {
    this.doc.setFontSize(fontSize);
    this.doc.setFont(undefined, 'normal');
    this.doc.setTextColor(0);
    const lines = this.doc.splitTextToSize(text, this.maxWidth - indent);
    for (const line of lines) {
      this.checkPageBreak();
      this.doc.text(line, MARGIN + indent, this.y);
      this.y += lineHeight;
    }
  }

  addSeparator() {
    this.doc.setDrawColor(200);
    this.doc.line(MARGIN, this.y, this.pageWidth - MARGIN, this.y);
    this.y += 10;
  }

  addSpacing(amount = 10) {
    this.y += amount;
  }

  // ===== Reusable Sections =====

  renderKeyPoints(keyPoints) {
    if (!keyPoints || keyPoints.length === 0) return;

    this.writeSectionTitle(docHeading('keyPoints'));

    keyPoints.forEach((point, index) => {
      this.checkPageBreak(260);

      // Title
      this.doc.setFontSize(11);
      this.doc.setFont(undefined, 'bold');
      this.doc.setTextColor(...ACCENT_COLOR);
      const titleText = `${index + 1}. ${point.title}`;
      const titleLines = this.doc.splitTextToSize(titleText, this.maxWidth - 10);
      this.doc.text(titleLines, MARGIN, this.y);
      this.y += titleLines.length * 6 + 2;

      // Paragraph reference
      this.doc.setFontSize(8);
      this.doc.setTextColor(150);
      this.doc.text(`§${point.paragraphs}`, MARGIN, this.y);
      this.y += 5;

      // Description
      this.doc.setFontSize(9);
      this.doc.setFont(undefined, 'normal');
      this.doc.setTextColor(0);
      const descLines = this.doc.splitTextToSize(point.description, this.maxWidth - 5);
      for (const line of descLines) {
        this.checkPageBreak();
        this.doc.text(line, MARGIN + 5, this.y);
        this.y += 4.5;
      }

      this.y += 8;
    });
  }

  renderQA(qaList) {
    if (!qaList || qaList.length === 0) return;

    this.addSpacing();
    this.writeSectionTitle(docHeading('qa'));

    qaList.forEach((qa, index) => {
      this.checkPageBreak(250);

      // Question
      this.doc.setFontSize(11);
      this.doc.setFont(undefined, 'bold');
      this.doc.setTextColor(...ACCENT_COLOR);
      const questionText = `Q${index + 1}: ${qa.question}`;
      const questionLines = this.doc.splitTextToSize(questionText, this.maxWidth - 5);
      this.doc.text(questionLines, MARGIN, this.y);
      this.y += questionLines.length * 6 + 3;

      // Answer
      this.writeTextBlock(`${docLabel('answerShort')}${index + 1}: ${qa.answer}`, { indent: 5 });
      this.y += 8;
    });
  }

  renderFooter() {
    const pageCount = this.doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setTextColor(150);
      this.doc.text(
        docLabel('pageOf', { page: i, total: pageCount }),
        this.pageWidth / 2,
        this.doc.internal.pageSize.getHeight() - 10,
        { align: 'center' },
      );
    }
  }

  save(filename) {
    this.renderFooter();
    this.doc.save(filename);
  }

  static sanitizeFilename(title) {
    return title
      .substring(0, 50)
      .replace(/[^a-z0-9]/gi, '_')
      .toLowerCase();
  }
}
