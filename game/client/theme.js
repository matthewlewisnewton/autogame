import themeData from '../shared/theme.json';

export const THEME = themeData;

export function formatCurrencyHud(amount) {
	return `${THEME.currency.short} ${amount}`;
}

export function formatCurrencyLabel(amount) {
	return `${THEME.currency.label}: ${amount}`;
}

export function formatCurrencyPrice(price) {
	return `${price} ${THEME.currency.short.toLowerCase()}`;
}

export function formatUpgradeCostEmpty() {
	return `Cost: — ${THEME.currency.short}`;
}

export function formatUpgradeCost(cost, currency) {
	return `Cost: ${cost} ${THEME.currency.short} (you have ${currency})`;
}

export function formatMesetaEarned(amount) {
	return `+${amount} ${THEME.currency.short.toLowerCase()} earned`;
}

export function formatAttuneCost(cost) {
	return `Attune (${cost}m)`;
}

export function getCardTypeLabel(type) {
	return THEME.cardTypes[type] || type;
}
