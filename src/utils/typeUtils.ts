export const isState = (state: TNeutrals | IState): state is IState => state.i !== 0 && !(state as IState).removed;

export const isNeutals = (neutrals: TNeutrals | IState): neutrals is TNeutrals => neutrals.i === 0;

export const isCulture = (culture: TWilderness | ICulture): culture is ICulture =>
  culture.i !== 0 && !(culture as ICulture).removed;

export const isBurg = (burg: TNoBurg | IBurg): burg is IBurg => burg.i !== 0 && !(burg as IBurg).removed;

export const isReligion = (religion: TNoReligion | IReligion): religion is IReligion =>
  religion.i !== 0 && !(religion as IReligion).removed;
