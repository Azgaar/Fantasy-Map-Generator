interface IEvent {
  type: string;
  name: string;
  start: number;
  end?: number; // undefined for ongoing events
  description: string;
}

interface IConflict extends IEvent {
  type: "conflict";
  parties: {
    attackers: number[];
    defenders: number[];
  };
}
