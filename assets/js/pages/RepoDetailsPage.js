/*
  @author Sam Heutmaker [samheutmaker@gmail.com]
*/

import React, {Component, PropTypes} from 'react'
import Loader from './../components/Loader'
import RegistryNames from './../util/RegistryNames'
import RepoSettings from './../components/RepoSettings'
import CenteredConfirm from './../components/CenteredConfirm'
import RegistryProviderIcons from './../util/RegistryProviderIcons'
import DockerPullCommands from './../components/DockerPullCommands'
import NPECheck from './../util/NPECheck'
import RepoDetailsContent from './../components/RepoDetailsContent'
import ControlRoom from './../components/ControlRoom'
import BtnGroup from './../components/BtnGroup'
import Msg from './../components/Msg'
import NotFound from './../pages/NotFound'
import AccessDenied from './../components/AccessDenied';

export default class RepoDetailsPage extends Component {
  constructor(props) {
    super(props);

    let activeRepo = this.props.reposNameMap[this.props.params.repoName];

    this.state = {
      repoId: (activeRepo && activeRepo.id) ? activeRepo.id : this.props.repoName
    };
  }

  componentDidMount() {
    this.context.actions.resetRepoDetailsState();
    this.context.actions.toggleRepoDetailsPageXHR(true);
    this.context.actions.listRepos(this.state.repoId)
    .then(() => {
      return new Promise((resolve, reject) => {
        let activeRepo = this.props.reposNameMap[this.props.params.repoName];


        resolve((activeRepo) ? activeRepo.id : null);
      });
    })
    .then((repoId) => {
      let repoDeps = [
        this.context.actions.setActiveRepoDetails(repoId),
        this.context.actions.getRepoOverview(repoId)
      ];

      return Promise.all(repoDeps);
    })
    .then(this.context.actions.toggleRepoDetailsPageXHR.bind(this, false))
    .catch((err) => {
      console.error(err);
      this.context.actions.toggleRepoDetailsPageXHR(false);
    });
  }

  componentWillUnmount() {
    this.context.actions.resetRepoDetailsState();
    this.context.actions.resetNotifState();
  }

  toRepoList() {
    this.context.router.push('/repositories');
  }

  renderRepoSettings(activeRepo) {
    return (
      <ControlRoom renderHeaderContent={() => this.renderRepSettingsHeader()}
                   renderBodyContent={() => this.renderRepoSettingBody(activeRepo)}/>
    );
  }

  renderRepSettingsHeader() {
    return (
      <div className="AddEditRegistryLegend">
        <span style={{paddingLeft: '0'}}>Settings</span>
        <span className="Close"
              onClick={() => this.context.actions.toggleActiveRepoSettings()}>
					<i className="icon icon-dis-close"/>
				</span>
      </div>
    );
  }

  renderRepoSettingBody(activeRepo) {
    return (
      <RepoSettings
        {...this.props}
        activeRepo={activeRepo}
      />
    );
  }

  renderDeleteRepo(activeRepo) {
    if (this.props.repoDetails.deleteXHR) {
      return (
        <Loader/>
      );
    }

    let error = this.props.repoDetails.deleteRepoError;

    if (error) {
      return (
        <Msg text={error}
             style={{padding: '2rem 0'}}
             close={() => this.context.actions.clearRepoDetailsErrors()}/>
      );
    }

    let message = "Are you sure you want to disconnect this repository? All data will be lost.";
    let confirmText = "Disonnect";

    if (activeRepo.local) {
      message = "Are you sure you want to delete this repository? All data will be lost.";
      confirmText = "Delete";
    }


    if (this.props.repoDetails.isDeleting) {
      return (
        <CenteredConfirm message={message}
                         confirmButtonText={confirmText}
                         confirmButtonStyle={{}}
                         onConfirm={() => this.context.actions.deleteActiveRepo(this.toRepoList.bind(this))}
                         onCancel={() => this.context.actions.toggleActiveRepoDelete()}/>
      );
    }
  }

  renderEventTimeline() {
    let events = this.props.repoDetails.events;
    let manifests = this.props.repoDetails.manifests;

    return (
      <RepoDetailsContent
        {...this.props}
        events={events}
        manifests={manifests}
      />
    );
  }

  renderPageLoader() {
    return (
      <div className="PageLoader">
        <Loader/>
      </div>
    );
  }

  renderError(errorMsg) {
    return (
      <Msg text={errorMsg} style={{padding: '2rem 0'}}/>
    );
  }

  renderHeader(activeRepo) {
    return (
      <div className="SmallHeader FlexRow SpaceBetween">
        <div className="FlexColumn Flex1">
          <div className="FlexRow">
            <img src={RegistryProviderIcons(activeRepo.provider)}/>
            <h3>{activeRepo.name}</h3>
          </div>
          <span>{RegistryNames(true)[activeRepo.provider]}</span>
        </div>
        <div className="FlexRow">
          {this.renderRepoPullCommands()}
          {this.renderActions(activeRepo)}
        </div>
      </div>
    );
  }

  renderRepoPullCommands() {
    return (
      <DockerPullCommands {...this.props} />
    );
  }

  renderActions(activeRepo) {
    let buttons = [
      {
        icon: (activeRepo.local) ? 'icon icon-dis-trash' : 'icon icon-dis-terminate',
        onClick: () => this.context.actions.toggleActiveRepoDelete(),
        isActive: this.props.repoDetails.isDeleting,
        toolTip: (activeRepo.local) ? 'Delete Repository' : 'Disconnect'
      },
      {
        icon: 'icon icon-dis-configure',
        onClick: () => this.context.actions.toggleActiveRepoSettings(),
        isActive: this.props.repoDetails.showSettings,
        toolTip: 'Repository Settings'
      }
    ];

    return (
      <BtnGroup buttons={buttons}/>
    );
  }

  render() {
    let isBlocked = NPECheck(this.props, 'repoDetails/isBlocked', false);

    if (isBlocked) {
      return (
        <AccessDenied/>
      );
    }

    if (NPECheck(this.props, 'repoDetails/noRepo', false)) {
      return (
        <NotFound {...this.props} message="Repository Not Found."/>
      );
    }

    let errorMsg = NPECheck(this.props, 'repoDetails/eventsError', false);

    if (errorMsg) {
      return this.renderError(errorMsg);
    }

    if (this.props.repoDetails.pageXHR) {
      return this.renderPageLoader()
    }

    let activeRepo = NPECheck(this.props, 'repoDetails/activeRepo', {});

    return (
      <div className="ContentContainer">
        {this.renderHeader(activeRepo)}
        <div>
          {this.renderDeleteRepo(activeRepo)}
          {(this.props.repoDetails.showSettings) ? this.renderRepoSettings(activeRepo) : this.renderEventTimeline()}
        </div>
      </div>
    );
  }
}

RepoDetailsPage.childContextTypes = {
  actions: PropTypes.object,
  router: PropTypes.object
};

RepoDetailsPage.contextTypes = {
  actions: PropTypes.object,
  router: PropTypes.object
};
