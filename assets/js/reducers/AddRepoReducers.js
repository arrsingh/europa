/*
  @author Sam Heutmaker [samheutmaker@gmail.com]
*/

import CreateOrSetPropertyValue from './../util/CreateOrSetPropertyValue'

export default function AddRepoReducers(state, action) {
  switch (action.type) {
    case 'UPDATE_NEW_REPO':
      return updateNewRepo(state, action.data);

    case 'UPDATE_NEW_NOTIFICATION':
      return updateNewNotification(state, action.data);

    default:
      return state;
  }
}

function updateNewRepo(state, data) {
  let newRepo = state.newRepo;
  CreateOrSetPropertyValue(newRepo, data.keyPath, data.value);

  return {
    ...state,
    newRepo
  };
}

function updateNewNotification(state, data) {
  let newNotif = state.newNotification;
  CreateOrSetPropertyValue(newNotif, data.key, data.value);

  return {
    ...state,
    newNotif
  };
}
