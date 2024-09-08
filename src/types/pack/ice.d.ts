
interface IIceBase {
    points: TPoints;
    transform: {x: number, y: number};
}

interface IiceBerg extends IIceBase {
    cell: number;
    size: number;
}

interface IiceShield extends IIceBase {
}

interface IIce{
    icebergs: IiceBerg[];
    iceShields: IiceShield[];
}