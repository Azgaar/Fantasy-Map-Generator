interface IEvents {
  conflicts: IConflict[];
}

interface IEvent {
  name: string;
  start: number;
  end?: number; // undefined for ongoing events
  description?: string;
}

interface IConflict extends IEvent {
  parties: {
    attackers: number[];
    defenders: number[];
  };
}
