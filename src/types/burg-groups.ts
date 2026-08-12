export type BurgGroup = {
  name: string;
  order: number;
  active?: boolean;
  isDefault?: boolean;
  removed?: boolean;
  min?: number;
  max?: number;
  percentile?: number;
  features?: Record<string, boolean>;
  biomes?: number[];
  states?: number[];
  cultures?: number[];
  religions?: number[];
  preview?: string;
};
