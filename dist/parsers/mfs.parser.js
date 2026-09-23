const PROVIDER_RULES = [
    {
        provider: 'bKash',
        keywords: ['BKASH', '16247'],
        trxRegex: /TrxID\s+([A-Z0-9_-]+)/i,
        amountRegex: /(?:received(?: payment)?|Cash In)\s+Tk\s+([\d,]+\.?\d*)/i,
        senderRegex: /from\s+([0-9+]+)/i,
        balanceRegex: /Balance\s+Tk\s+([\d,]+\.?\d*)/i,
        bodyKeywords: ['bKash', 'TrxID'],
    },
    {
        provider: 'Nagad',
        keywords: ['NAGAD', '16167'],
        trxRegex: /(?:TxnID|TrxID):\s*([A-Z0-9]+)/i,
        amountRegex: /(?:Amount:?\s*Tk|Received Amount:?\s*Tk)\s*([\d,]+\.?\d*)/i,
        senderRegex: /(?:from|Sender:?)\s*([0-9+]+)/i,
        balanceRegex: /Balance:?\s*Tk\s*([\d,]+\.?\d*)/i,
        bodyKeywords: ['Nagad', 'TxnID'],
    },
    {
        provider: 'Rocket',
        keywords: ['ROCKET', '16216'],
        trxRegex: /(?:TxnId|TrxID|Txn ID):\s*([A-Z0-9]+)/i,
        amountRegex: /Tk\s*([\d,]+\.?\d*)\s*received/i,
        senderRegex: /from\s*([0-9+]+)/i,
        balanceRegex: /Balance:\s*Tk\s*([\d,]+\.?\d*)/i,
    },
    {
        provider: 'Upay',
        keywords: ['UPAY', '16268'],
        trxRegex: /(?:TrxID|TxnID|Txn ID):\s*([A-Z0-9]+)|(?:TrxID|TxnID)\s+([A-Z0-9]+)/i,
        amountRegex: /(?:received(?: payment)?|Cash In)\s+Tk\s+([\d,]+\.?\d*)|Tk\s*([\d,]+\.?\d*)\s*received/i,
        senderRegex: /from\s+([0-9+]+)/i,
        balanceRegex: /Balance\s+Tk\s+([\d,]+\.?\d*)/i,
        bodyKeywords: ['upay'],
    },
    {
        provider: 'DBBL',
        keywords: ['DBBL', 'DUTCH-BANGLA', 'DUTCHBANGLA'],
        trxRegex: /(?:Ref|TxnRef|TxnID|Ref No):\s*([A-Z0-9]+)/i,
        amountRegex: /[Cc]redited\s+BDT\s+([\d,]+\.?\d*)|BDT\s+([\d,]+\.?\d*)\s+(?:credited|deposited|received)/i,
        balanceRegex: /(?:Bal|Avl Bal|Balance):\s*BDT\s*([\d,]+\.?\d*)/i,
    },
    {
        provider: 'BRAC',
        keywords: ['BRAC BANK', 'BRACBANK'],
        trxRegex: /(?:Ref|TxnID|TxnRef):\s*([A-Z0-9-]+)/i,
        amountRegex: /BDT\s+([\d,]+\.?\d*)\s+has been credited|[Cc]redit alert:?\s*BDT\s*([\d,]+\.?\d*)|BDT\s+([\d,]+\.?\d*)\s+credited/i,
        balanceRegex: /(?:Bal|Avail Bal|Balance):\s*BDT\s*([\d,]+\.?\d*)/i,
        bodyKeywords: ['BRAC'],
    },
    {
        provider: 'IslamiBank',
        keywords: ['IBBL', 'ISLAMI BANK', 'ISLAMIBANK'],
        trxRegex: /(?:TxnID|Ref|TrxID):\s*([A-Z0-9-]+)/i,
        amountRegex: /BDT\s+([\d,]+\.?\d*)\s+(?:deposited|credited)|(?:deposited|credited)\s+BDT\s*([\d,]+\.?\d*)/i,
        balanceRegex: /(?:Bal|Available Bal|Balance):\s*BDT\s*([\d,]+\.?\d*)/i,
        bodyKeywords: ['IBBL'],
    },
    {
        provider: 'CityBank',
        keywords: ['CITY BANK', 'CITYBANK', 'CBTXN'],
        trxRegex: /(?:Ref|TxnRef|TxnID):\s*([A-Z0-9]+)/i,
        amountRegex: /Amount BDT\s*([\d,]+\.?\d*)\s+has been credited|[Cc]redit:\s*BDT\s*([\d,]+\.?\d*)|BDT\s*([\d,]+\.?\d*)\s+(?:credited|deposited)/i,
        balanceRegex: /(?:Bal|Avail Bal|Balance):\s*BDT\s*([\d,]+\.?\d*)/i,
    },
];
export class MfsParser {
    static parseWithRule(rule, text) {
        const trxMatch = text.match(rule.trxRegex);
        const amountMatch = text.match(rule.amountRegex);
        if (trxMatch && amountMatch) {
            const trxId = (trxMatch[1] || trxMatch[2] || '').toUpperCase();
            const rawAmt = amountMatch[1] || amountMatch[2] || amountMatch[3] || '0';
            const senderMatch = rule.senderRegex ? text.match(rule.senderRegex) : null;
            const balanceMatch = rule.balanceRegex ? text.match(rule.balanceRegex) : null;
            return {
                success: true,
                provider: rule.provider,
                trxId,
                amount: parseFloat(rawAmt.replace(/,/g, '')),
                sender: senderMatch?.[1]?.replace(/^\+?88/, ''),
                balance: balanceMatch ? parseFloat((balanceMatch[1] || '0').replace(/,/g, '')) : undefined,
                rawText: text,
            };
        }
        return {
            success: false,
            provider: rule.provider,
            rawText: text,
            error: `Failed to extract ${rule.provider} TrxID or Amount`,
        };
    }
    static parse(senderAddress, body) {
        const combined = `${senderAddress} ${body}`.toUpperCase();
        // 1. Match by address/header keywords
        for (const rule of PROVIDER_RULES) {
            if (rule.keywords.some(kw => combined.includes(kw))) {
                return this.parseWithRule(rule, body);
            }
        }
        // 2. Auto-detect by body keywords if header is generic
        for (const rule of PROVIDER_RULES) {
            if (rule.bodyKeywords && rule.bodyKeywords.some(bk => body.toLowerCase().includes(bk.toLowerCase()))) {
                return this.parseWithRule(rule, body);
            }
        }
        return {
            success: false,
            provider: 'UNKNOWN',
            rawText: body,
            error: 'Unrecognized MFS/Bank SMS format',
        };
    }
}
