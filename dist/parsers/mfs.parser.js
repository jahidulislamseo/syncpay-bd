export class MfsParser {
    // ─── MFS Wallets ─────────────────────────────────────────────────────────
    /** bKash: received Tk X.XX from PHONE ... TrxID ABC */
    static parseBkash(text) {
        const trxMatch = text.match(/TrxID\s+([A-Z0-9_-]+)/i);
        const amountMatch = text.match(/(?:received(?: payment)?|Cash In)\s+Tk\s+([\d,]+\.?\d*)/i);
        const senderMatch = text.match(/from\s+([0-9+]+)/i);
        const balanceMatch = text.match(/Balance\s+Tk\s+([\d,]+\.?\d*)/i);
        if (trxMatch && amountMatch) {
            return {
                success: true, provider: 'bKash',
                trxId: trxMatch[1].toUpperCase(),
                amount: parseFloat(amountMatch[1].replace(/,/g, '')),
                sender: senderMatch?.[1].replace(/^\+?88/, ''),
                balance: balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : undefined,
                rawText: text,
            };
        }
        return { success: false, provider: 'bKash', rawText: text, error: 'Failed to extract bKash TrxID or Amount' };
    }
    /** Nagad: Amount: Tk X.XX ... TxnID: ABC */
    static parseNagad(text) {
        const trxMatch = text.match(/(?:TxnID|TrxID):\s*([A-Z0-9]+)/i);
        const amountMatch = text.match(/(?:Amount:?\s*Tk|Received Amount:?\s*Tk)\s*([\d,]+\.?\d*)/i);
        const senderMatch = text.match(/(?:from|Sender:?)\s*([0-9+]+)/i);
        const balanceMatch = text.match(/Balance:?\s*Tk\s*([\d,]+\.?\d*)/i);
        if (trxMatch && amountMatch) {
            return {
                success: true, provider: 'Nagad',
                trxId: trxMatch[1].toUpperCase(),
                amount: parseFloat(amountMatch[1].replace(/,/g, '')),
                sender: senderMatch?.[1].replace(/^\+?88/, ''),
                balance: balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : undefined,
                rawText: text,
            };
        }
        return { success: false, provider: 'Nagad', rawText: text, error: 'Failed to extract Nagad TxnID or Amount' };
    }
    /** Rocket: Tk X.XX received from PHONE. TxnId: ABC */
    static parseRocket(text) {
        const trxMatch = text.match(/(?:TxnId|TrxID|Txn ID):\s*([A-Z0-9]+)/i);
        const amountMatch = text.match(/Tk\s*([\d,]+\.?\d*)\s*received/i);
        const senderMatch = text.match(/from\s*([0-9+]+)/i);
        if (trxMatch && amountMatch) {
            return {
                success: true, provider: 'Rocket',
                trxId: trxMatch[1].toUpperCase(),
                amount: parseFloat(amountMatch[1].replace(/,/g, '')),
                sender: senderMatch?.[1].replace(/^\+?88/, ''),
                rawText: text,
            };
        }
        return { success: false, provider: 'Rocket', rawText: text, error: 'Failed to extract Rocket TxnId or Amount' };
    }
    /** Upay: received Tk X.XX ... TrxID ABC */
    static parseUpay(text) {
        const trxMatch = text.match(/(?:TrxID|TxnID|Txn ID):\s*([A-Z0-9]+)/i) || text.match(/(?:TrxID|TxnID)\s+([A-Z0-9]+)/i);
        const amountMatch = text.match(/(?:received(?: payment)?|Cash In)\s+Tk\s+([\d,]+\.?\d*)/i) || text.match(/Tk\s*([\d,]+\.?\d*)\s*received/i);
        const senderMatch = text.match(/from\s+([0-9+]+)/i);
        const balanceMatch = text.match(/Balance\s+Tk\s+([\d,]+\.?\d*)/i);
        if (trxMatch && amountMatch) {
            return {
                success: true, provider: 'Upay',
                trxId: trxMatch[1].toUpperCase(),
                amount: parseFloat(amountMatch[1].replace(/,/g, '')),
                sender: senderMatch?.[1].replace(/^\+?88/, ''),
                balance: balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : undefined,
                rawText: text,
            };
        }
        return { success: false, provider: 'Upay', rawText: text, error: 'Failed to extract Upay TrxID or Amount' };
    }
    // ─── Banks ───────────────────────────────────────────────────────────────
    /**
     * DBBL (Dutch-Bangla Bank):
     * "Credited BDT 2,000.00 to A/C XXXX1234. Ref: TXN20260919001. Bal: BDT 15,400.00"
     * "A/C XXXX1234 credited BDT 500.00. TxnRef: DB001. Avl Bal: BDT 8,200.00"
     */
    static parseDBBL(text) {
        const trxMatch = text.match(/(?:Ref|TxnRef|TxnID|Ref No):\s*([A-Z0-9]+)/i);
        const amountMatch = text.match(/[Cc]redited\s+BDT\s+([\d,]+\.?\d*)/i) ||
            text.match(/BDT\s+([\d,]+\.?\d*)\s+(?:credited|deposited|received)/i);
        const balanceMatch = text.match(/(?:Bal|Avl Bal|Balance):\s*BDT\s*([\d,]+\.?\d*)/i);
        if (trxMatch && amountMatch) {
            return {
                success: true, provider: 'DBBL',
                trxId: trxMatch[1].toUpperCase(),
                amount: parseFloat(amountMatch[1].replace(/,/g, '')),
                balance: balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : undefined,
                rawText: text,
            };
        }
        return { success: false, provider: 'DBBL', rawText: text, error: 'Failed to parse DBBL SMS' };
    }
    /**
     * BRAC Bank:
     * "Dear Customer, BDT 1,500.00 has been credited to A/C XXXX5678. Ref: BRAC001. Bal: BDT 22,400.00"
     * "Credit alert: BDT 800.00 credited. TxnID: BRAC-TXN-001. Avail Bal: BDT 9,100.00"
     */
    static parseBRAC(text) {
        const trxMatch = text.match(/(?:Ref|TxnID|TxnRef):\s*([A-Z0-9-]+)/i);
        const amountMatch = text.match(/BDT\s+([\d,]+\.?\d*)\s+has been credited/i) ||
            text.match(/[Cc]redit alert:?\s*BDT\s*([\d,]+\.?\d*)/i) ||
            text.match(/BDT\s+([\d,]+\.?\d*)\s+credited/i);
        const balanceMatch = text.match(/(?:Bal|Avail Bal|Balance):\s*BDT\s*([\d,]+\.?\d*)/i);
        if (trxMatch && amountMatch) {
            return {
                success: true, provider: 'BRAC',
                trxId: trxMatch[1].toUpperCase(),
                amount: parseFloat(amountMatch[1].replace(/,/g, '')),
                balance: balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : undefined,
                rawText: text,
            };
        }
        return { success: false, provider: 'BRAC', rawText: text, error: 'Failed to parse BRAC Bank SMS' };
    }
    /**
     * Islami Bank Bangladesh (IBBL):
     * "BDT 1,000.00 deposited to your IBBL A/C. TxnID: IB2026001. Bal: BDT 5,600.00"
     * "Your IBBL account credited BDT 2,500.00. Ref: IBBL-001. Available Bal: BDT 14,200.00"
     */
    static parseIslamiBank(text) {
        const trxMatch = text.match(/(?:TxnID|Ref|TrxID):\s*([A-Z0-9-]+)/i);
        const amountMatch = text.match(/BDT\s+([\d,]+\.?\d*)\s+(?:deposited|credited)/i) ||
            text.match(/(?:deposited|credited)\s+BDT\s*([\d,]+\.?\d*)/i);
        const balanceMatch = text.match(/(?:Bal|Available Bal|Balance):\s*BDT\s*([\d,]+\.?\d*)/i);
        if (trxMatch && amountMatch) {
            return {
                success: true, provider: 'IslamiBank',
                trxId: trxMatch[1].toUpperCase(),
                amount: parseFloat(amountMatch[1].replace(/,/g, '')),
                balance: balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : undefined,
                rawText: text,
            };
        }
        return { success: false, provider: 'IslamiBank', rawText: text, error: 'Failed to parse Islami Bank SMS' };
    }
    /**
     * City Bank:
     * "Amount BDT 500.00 has been credited to your City Bank A/C. Ref: CB001. Bal: BDT 8,900.00"
     * "Credit: BDT 1,200.00 to your A/C. TxnRef: CBTXN001. Avail Bal: BDT 12,000.00"
     */
    static parseCityBank(text) {
        const trxMatch = text.match(/(?:Ref|TxnRef|TxnID):\s*([A-Z0-9]+)/i);
        const amountMatch = text.match(/Amount BDT\s*([\d,]+\.?\d*)\s+has been credited/i) ||
            text.match(/[Cc]redit:\s*BDT\s*([\d,]+\.?\d*)/i) ||
            text.match(/BDT\s*([\d,]+\.?\d*)\s+(?:credited|deposited)/i);
        const balanceMatch = text.match(/(?:Bal|Avail Bal|Balance):\s*BDT\s*([\d,]+\.?\d*)/i);
        if (trxMatch && amountMatch) {
            return {
                success: true, provider: 'CityBank',
                trxId: trxMatch[1].toUpperCase(),
                amount: parseFloat(amountMatch[1].replace(/,/g, '')),
                balance: balanceMatch ? parseFloat(balanceMatch[1].replace(/,/g, '')) : undefined,
                rawText: text,
            };
        }
        return { success: false, provider: 'CityBank', rawText: text, error: 'Failed to parse City Bank SMS' };
    }
    // ─── Universal entrypoint ────────────────────────────────────────────────
    static parse(senderAddress, body) {
        const combined = `${senderAddress} ${body}`.toUpperCase();
        // MFS Wallets (priority order)
        if (combined.includes('BKASH') || combined.includes('16247'))
            return this.parseBkash(body);
        if (combined.includes('NAGAD') || combined.includes('16167'))
            return this.parseNagad(body);
        if (combined.includes('ROCKET') || combined.includes('16216'))
            return this.parseRocket(body);
        if (combined.includes('UPAY') || combined.includes('16268'))
            return this.parseUpay(body);
        // Banks
        if (combined.includes('DBBL') || combined.includes('DUTCH-BANGLA') || combined.includes('DUTCHBANGLA'))
            return this.parseDBBL(body);
        if (combined.includes('BRAC BANK') || combined.includes('BRACBANK'))
            return this.parseBRAC(body);
        if (combined.includes('IBBL') || combined.includes('ISLAMI BANK') || combined.includes('ISLAMIBANK'))
            return this.parseIslamiBank(body);
        if (combined.includes('CITY BANK') || combined.includes('CITYBANK') || combined.includes('CBTXN'))
            return this.parseCityBank(body);
        // Auto-detect by body keywords
        if (body.includes('bKash') || body.includes('TrxID'))
            return this.parseBkash(body);
        if (body.includes('Nagad') || body.includes('TxnID'))
            return this.parseNagad(body);
        if (body.toLowerCase().includes('upay'))
            return this.parseUpay(body);
        if (body.includes('IBBL'))
            return this.parseIslamiBank(body);
        if (body.includes('BRAC'))
            return this.parseBRAC(body);
        return {
            success: false,
            provider: 'UNKNOWN',
            rawText: body,
            error: 'Unrecognized MFS/Bank SMS format',
        };
    }
}
