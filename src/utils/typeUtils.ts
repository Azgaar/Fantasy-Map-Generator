export const isState = (state: TNeutrals | IState): state is IState => state.i !== 0 && !(state as IState).removed;

export const isCulture = (culture: TWilderness | ICulture): culture is ICulture =>
  culture.i !== 0 && !(culture as ICulture).removed;

export const isBurg = (burg: TNoBurg | IBurg): burg is IBurg => burg.i !== 0 && !(burg as IBurg).removed;
