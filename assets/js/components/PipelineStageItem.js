import React, { Component, PropTypes } from 'react'
import { Link } from 'react-router'
import ConvertTimeFriendly from './../util/ConvertTimeFriendly'
import CenteredConfirm from './../components/CenteredConfirm'
import Loader from './../components/Loader'
import NPECheck from './../util/NPECheck'
import RegistryProviderIcons from './../util/RegistryProviderIcons'
import {
  getRepoRedirect
} from './../util/RedirectHelper'

export default class PipelineStageItem extends Component {
  constructor(props) {
    super(props);
    this.state = {
      deleteToggled: false,
      pipelineComponentObj: this.props.pipelineComponentObj
    };
  }
  renderTrigger(repo) {
    if (!repo) return;
    if (this.props.empty) return;
    if (this.props.firstStage) return;
    let imageName = (this.props.automatic) ? "dis-pipeline-green.svg" : "dis-pipeline-yellow.svg";
    let checkboxClasses = (this.props.automatic) ? "icon-dis-box-check cursor-on-hover" : "icon-dis-box-uncheck cursor-on-hover";
    // TODO: implement checkbox handling
    // TODO: implement promote button
    return (
      <div className="stage-trigger">
        <div className="stage-trigger-pipe">
          <img src={`/public/images/${imageName}`} />
        </div>
        <div className="stage-trigger-toggle">
          <div className="stage-trigger-toggle-check">
            <div className="stage-trigger-auto">
              <i className={checkboxClasses}
                 onClick={() => this.context.actions.togglePipelineComponentAutomaticPromotion(this.props.pipelineComponentObj)} />
              <span>Auto Promote on Image Event</span>
            </div>
              {/*this.renderPromoteButton()*/}
          </div>
        </div>
      </div>
    );
  }
  renderEmptyOption() {
    if (!NPECheck(this.props.stage, 'autoDeployTrigger', null)) {
      return <option value="">Select...</option>
    }
  }
  renderStage(repo) {
    // If repo is null, the user doesn't have access
    return (
      <div className="pipeline-stage-item">
        {this.renderTrigger(repo)}
        <div className="pipeline-grey-wrap">
          <div className="stage-destination-wrap">
            <div className="left-icon-col" style={ {background: "#2E5597"} }>
              <img src={RegistryProviderIcons(NPECheck(repo || {}, 'provider', "DELETED"), true)} />
            </div>
            <div className="stage-destinations">
              { repo ? this.renderInterior(repo) : this.renderUnauthorizedInterior() }
            </div>
          </div>
        </div>
      </div>
    );
  }
  renderDeleteStage() {
    if (!this.props.firstStage) {
      return (
        <div className="delete-stage">
          <i className="icon-dis-close"
             onClick={() => this.setState({deleteToggled: !this.state.deleteToggled})} />
        </div>
      );
    }
  }
  renderDeleteMainStage() {
    if (this.props.firstStage && NPECheck(this.props, 'pipelineStore/pipeline/components', []).length == 0) {
      return (
        <div className="delete-stage">
          <i className="icon-dis-close"
             onClick={() => this.setState({deleteToggled: !this.state.deleteToggled})} />
        </div>
      );
    }
  }
  deleteStage() {
    if (this.props.firstStage) {
      this.context.actions.removeMainPipelineStage()
    } else {
      this.context.actions.removePipelineComponent(this.state.pipelineComponentObj.id)
    }
  }
  renderConfirmOrError() {
    let msg = "Are you sure you want to remove this stage?";

    if (this.props.pipelineStore.removePipelineComponentXHRError) {
      msg = this.props.pipelineStore.removePipelineComponentXHRError;
    }

    if (this.props.pipelineStore.removePipelineMainStageXHRError) {
      msg = this.props.pipelineStore.removePipelineMainStageXHRError;
    }

    return msg;
  }
  isDeletingStage() {
    if (this.props.pipelineStore.removePipelineMainStageXHR) {
      return true;
    }
    // NPECheck has a backup result of unallowable ID characters, because removePipelineComponentXHR could be null/false
    if (this.props.pipelineStore.removePipelineComponentXHR == NPECheck(this.state, 'pipelineComponentObj/id', "!@#$%^&*()(&^)*^&$%")) {
      return true;
    }
    return false;
  }
  renderUnauthorizedInterior() {
    return (
      <div className="stage-destination">
        <div className="stage-dest-interior">
          <div className="stage-dest-details">
            <div style={ {position: "relative"} }>
              <span style={{color: "grey", fontSize: ".85rem", fontWeight: "400"}}>
                You are not authorized to view this Repository
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  renderInterior(repo) {
    if (this.isDeletingStage()) {
      return (
        <div className="stage-destination">
          <div style={ {margin: "15px 0 0"} }>
            <Loader />
          </div>
        </div>
      );
    }

    if (this.state.deleteToggled) {
      return (
        <div className="stage-destination">
          <CenteredConfirm onConfirm={ () => this.deleteStage.call(this) }
                           onCancel={ () => this.setState({deleteToggled: !this.state.deleteToggled}) }
                           confirmButtonStyle={{background: "#df423a"}}
                           confirmButtonText="Remove"
                           messageStyle={ {fontSize: ".75rem", margin: "7px 0 4px"} }
                           message={this.renderConfirmOrError()} />
        </div>
      );
    }

    let lastEvent = NPECheck(repo, 'lastEvent', {
      imageTags: [],
      imageSha: "N/A"
    });
    let friendlyTime = (lastEvent.eventTime) ? ConvertTimeFriendly(lastEvent.eventTime) : 'Unknown';

    return (
      <div className="stage-destination">
        <div className="stage-dest-interior">
          <div className="stage-dest-details">
            <div style={ {position: "relative", top: "2px"} }>
              <span style={{color: "#1DAFE9", fontSize: ".75rem", fontWeight: "900"}}>
                <Link to={`/repositories/${getRepoRedirect(repo)}`}>
                  {repo.name}
                </Link>
              </span>
            </div>
            <div>
              <div className="meta-details">
                <strong>Last Pushed:</strong>
                <span>{friendlyTime}</span>
              </div>
              <div className="meta-details">
                <strong>Image SHA:</strong>
                <span>
                  { lastEvent.imageSha != "N/A"
                    ? `${lastEvent.imageSha.substring(7, lastEvent.imageSha.length)}`
                    : lastEvent.imageSha }
                </span>
              </div>
              <div className="meta-details">
                <strong>Tags:</strong>
                <span>
                  {lastEvent.imageTags.map((tag, index) => {
                    return (
                      <span className="Tag" key={index}>
                        {tag}
                      </span>
                    );
                  })}
                </span>
              </div>
            </div>
          </div>
          {this.props.firstStage ? this.renderDeleteMainStage() : this.renderDeleteStage()}
        </div>
      </div>
    );
  }
  render() {
    if (this.props.empty) {
      return this.renderEmptyStage();
    }

    return this.renderStage(this.props.repo);
  }
}

PipelineStageItem.childContextTypes = {
    actions: PropTypes.object,
    router: PropTypes.object
};

PipelineStageItem.contextTypes = {
    actions: PropTypes.object,
    router: PropTypes.object
};

PipelineStageItem.propTypes = {
  empty: PropTypes.bool,
};
