import React, {Component, PropTypes} from 'react'
import NPECheck from './../util/NPECheck'
import {Link} from 'react-router'
import Btn from './../components/Btn'
import Loader from './../components/Loader'
import BtnGroup from './../components/BtnGroup'
import ControlRoom from './../components/ControlRoom'
import Dropdown from './../components/Dropdown'
import CenteredConfirm from './../components/CenteredConfirm'
import RegistryProviderIcons from './../util/RegistryProviderIcons'
import Msg from './../components/Msg'
import * as PipelineComponents from '../util/PipelineComponents';

export default class PipelineConnectRepository extends Component {
  constructor(props) {
    super(props);
    this.state = {
      repoDropdownOpen: false
    };
  }

  renderConfirm() {
    if (this.props.pipelineStore.setContainerRepoXHR
      || this.props.pipelineStore.addPipelineComponentXHR) {
      return (
        <div className="PageLoader">
          <Loader/>
        </div>
      );
    }

    return (
      <div>
        {this.renderErrorMsg()}
        <CenteredConfirm confirmButtonText="Connect"
                         noMessage={true}
                         confirmButtonStyle={{}}
                         onConfirm={this.props.initialConnect
                           ? this.context.actions.setContainerRepo
                           : () => this.context.actions.addPipelineComponent(PipelineComponents.types.copyToRepository)}
                         onCancel={() => this.context.actions.setPipelinePageSection(null)}/>
      </div>
    );
  }

  renderErrorMsg() {
    if (this.props.pipelineStore.setContainerRepoXHRError) {
      return (
        <Msg text={this.props.pipelineStore.setContainerRepoXHRError}
             close={() => this.context.actions.clearPipelineXHRErrors()}/>
      );
    }

    if (this.props.pipelineStore.addPipelineComponentXHRError) {
      return (
        <Msg text={this.props.pipelineStore.addPipelineComponentXHRError}
             close={() => this.context.actions.clearPipelineXHRErrors()}/>
      );
    }
  }

  renderRepoItem(repo, index) {
    return (
      <div key={index}
           className="ListItem FlexRow"
           onClick={() => this.context.actions.updateRepoConnect(repo)}>
        <img src={RegistryProviderIcons(repo.provider)}/>
        {repo.name}
      </div>
    );
  }

  filterRepoItems() {
    let mapOfComponentIds = NPECheck(this.props.pipelineStore, 'pipeline/components', []).reduce((map, component) => {
      map[component.destinationContainerRepoId] = true;
      return map;
    }, {})

    return this.props.repos.filter(repo => this.props.pipelineStore.pipeline.containerRepoId != repo.id)
    .filter(repo => !mapOfComponentIds.hasOwnProperty(repo.id))
    .filter(repo => (this.props.initialConnect && !repo.local) ? false : true)
  }

  render() {
    return (
      <div>
        <div className="CR_Header">
          <span className="CR_HeaderTitle">
            Connect Repository
          </span>
          <span className="CR_HeaderClose">
            <i className="icon-dis-close"
               onClick={() => this.context.actions.setPipelinePageSection(null)}/>
          </span>
        </div>
        <div className="CR_BodyContent">
          <div className="ContentContainer">
            <div className="Flex1">
              <label className="small FlexColumn">
                Docker Image Repository
              </label>
              <Dropdown isOpen={this.state.repoDropdownOpen}
                        toggleOpen={() => this.setState({repoDropdownOpen: !this.state.repoDropdownOpen})}
                        listItems={this.filterRepoItems()}
                        renderItem={(repo, index) => this.renderRepoItem(repo, index)}
                        inputPlaceholder="Docker Image Repository"
                        inputClassName="BlueBorder FullWidth White"
                        inputValue={NPECheck(this.props.pipelineStore, 'newComponentData/destinationContainerRepoName', "")}
                        className="Flex1"/>
            </div>
            <div className="Flex1">
              {this.renderConfirm()}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

PipelineConnectRepository.childContextTypes = {
  actions: PropTypes.object,
  router: PropTypes.object
};

PipelineConnectRepository.contextTypes = {
  actions: PropTypes.object,
  router: PropTypes.object
};
