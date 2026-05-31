import * as vscode from 'vscode';

export interface QuotaData {
	dailyUsage: number;
	monthlyUsage: number;
	dailyReset: number;
	monthlyReset: number;
	calls: Array<{ timestamp: number; type: string; tokens: number }>;
}

export class QuotaManager {
	private context: vscode.ExtensionContext;
	private quotaData: QuotaData;
	private storageKey = 'claude-copilot-quota';

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.quotaData = {
			dailyUsage: 0,
			monthlyUsage: 0,
			dailyReset: Date.now() + 24 * 60 * 60 * 1000,
			monthlyReset: Date.now() + 30 * 24 * 60 * 60 * 1000,
			calls: []
		};
	}

	async initialize() {
		const stored = this.context.globalState.get<QuotaData>(this.storageKey);
		if (stored) this.quotaData = stored;
		this.checkReset();
	}

	private checkReset() {
		const now = Date.now();
		if (now > this.quotaData.dailyReset) {
			this.quotaData.dailyUsage = 0;
			this.quotaData.dailyReset = now + 24 * 60 * 60 * 1000;
		}
		if (now > this.quotaData.monthlyReset) {
			this.quotaData.monthlyUsage = 0;
			this.quotaData.calls = [];
			this.quotaData.monthlyReset = now + 30 * 24 * 60 * 60 * 1000;
		}
	}

	async recordUsage(type: string, tokens: number = 1): Promise<boolean> {
		this.checkReset();
		const config = vscode.workspace.getConfiguration('claude-copilot');
		const dailyLimit = config.get<number>('dailyLimit', 50);
		const monthlyLimit = config.get<number>('monthlyLimit', 1000);

		if (this.quotaData.dailyUsage >= dailyLimit) {
			vscode.window.showWarningMessage('Daily quota exceeded! Reset tomorrow.');
			return false;
		}
		if (this.quotaData.monthlyUsage >= monthlyLimit) {
			vscode.window.showWarningMessage('Monthly quota exceeded!');
			return false;
		}

		this.quotaData.dailyUsage += tokens;
		this.quotaData.monthlyUsage += tokens;
		this.quotaData.calls.push({ timestamp: Date.now(), type, tokens });
		await this.save();
		return true;
	}

	getStatus() {
		this.checkReset();
		const config = vscode.workspace.getConfiguration('claude-copilot');
		const dailyLimit = config.get<number>('dailyLimit', 50);
		const monthlyLimit = config.get<number>('monthlyLimit', 1000);
		const dailyHours = Math.max(0, Math.floor((this.quotaData.dailyReset - Date.now()) / 3600000));
		const monthlyDays = Math.max(0, Math.floor((this.quotaData.monthlyReset - Date.now()) / 86400000));

		return {
			dailyUsed: this.quotaData.dailyUsage,
			dailyLimit,
			dailyRemaining: Math.max(0, dailyLimit - this.quotaData.dailyUsage),
			dailyPercentage: Math.round((this.quotaData.dailyUsage / dailyLimit) * 100),
			dailyResetIn: `${dailyHours}h`,
			monthlyUsed: this.quotaData.monthlyUsage,
			monthlyLimit,
			monthlyRemaining: Math.max(0, monthlyLimit - this.quotaData.monthlyUsage),
			monthlyPercentage: Math.round((this.quotaData.monthlyUsage / monthlyLimit) * 100),
			monthlyResetIn: `${monthlyDays}d`
		};
	}

	private async save() {
		await this.context.globalState.update(this.storageKey, this.quotaData);
	}

	hasApiKey(): boolean {
		const config = vscode.workspace.getConfiguration('claude-copilot');
		return config.get<string>('apiKey', '').length > 0;
	}

	getApiKey(): string {
		const config = vscode.workspace.getConfiguration('claude-copilot');
		return config.get<string>('apiKey', '');
	}

	getModel(): string {
		const config = vscode.workspace.getConfiguration('claude-copilot');
		return config.get<string>('model', 'claude-3-5-sonnet-20241022');
	}
}