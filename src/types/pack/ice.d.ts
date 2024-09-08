
export interface IIceBase {
    points: number[][];
}

export interface Iiceberg extends IIceBase {
    cell: number;
    size: number;
}

export interface IiceShield extends IIceBase {
    type: string;
}

export interface IIce{
    icebergs: Iiceberg[];
    iceShields: IiceShield[];
}