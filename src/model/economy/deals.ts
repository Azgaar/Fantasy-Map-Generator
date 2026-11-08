// Reading pack.deals. A deal stays a tuple on purpose: 10k+ per map at about 35 bytes each

import type { Deal, DealKind, Market, Transaction } from "@/types/economy";
import { Markets } from "./markets-generator";

export const DEAL_KINDS = { sale: 0, input: 1, demand: 2, kept: 3, order: 4 } as const satisfies Record<
  string,
  DealKind
>; // an order is a state's purchase, the burg its seat

class DealsModule {
  /** Money to the market: a burg's payment with carriage, less taxes, minus what it pays a burg */
  getMarketIncome(deal: Deal): number {
    const [, , , kind, units, price, tax, tariff] = deal;
    if (kind === DEAL_KINDS.kept) return 0;
    const margin = this.getMargin(deal); // the center burg's, not the market's
    if (kind === DEAL_KINDS.sale) return -units * price - margin;
    return units * price - tax - tariff - margin;
  }

  getMargin([, marketId, , kind, units, price, tax, tariff, carriage]: Deal): number {
    return this.marginOf(Markets.get(marketId), kind, { units, price, tax, tariff, carriage });
  }

  /** The market's spread on a trade, before taxes and carriage */
  marginOf(
    market: Market | undefined,
    kind: DealKind,
    { units, price, tax, tariff = 0, carriage = 0 }: Transaction
  ): number {
    if (kind === DEAL_KINDS.kept || !units) return 0;
    const rate = Markets.getMarginRate(market);
    if (kind === DEAL_KINDS.sale) return (units * (price + carriage) * rate) / (1 - rate);
    const marketPrice = price - (tax + tariff) / units - carriage;
    return (units * marketPrice * rate) / (1 + rate);
  }

  /** The deal's goods at the market's price: without carriage, taxes and the margin */
  getGoodsValue(deal: Deal): number {
    const [, , , kind, units, price, tax, tariff, carriage] = deal;
    const margin = this.getMargin(deal);
    return kind === DEAL_KINDS.sale
      ? units * (price + carriage) + margin
      : units * price - tax - tariff - units * carriage - margin;
  }
}

export const Deals = new DealsModule();
