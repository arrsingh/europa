import React, {Component, PropTypes} from 'react'
import { Link } from 'react-router'
import Btn from './../components/Btn'
import Loader from './../components/Loader'
import BtnGroup from './../components/BtnGroup'
import NPECheck from './../util/NPECheck'
import NotFound from './../pages/NotFound'
import ControlRoom from './../components/ControlRoom'
import AccessDenied from './../components/AccessDenied'
import CenteredConfirm from './../components/CenteredConfirm'
import PipelineStageItem from './../components/PipelineStageItem'
import PipelineConnectRepository from './../components/PipelineConnectRepository'
import * as PipelineComponents from '../util/PipelineComponents';

export default class Pipeline extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      timeoutInterval: null,
    };
  }
  componentDidMount() {
    let id = `${(this.props.isEnterprise) ? this.props.ctx.domain : 'd0'}:${this.props.params.pipelineId}`

    this.context.actions.listRepos()
    .then(() => this.context.actions.getPipeline(id))
    .then(pipeline => {
      this.setState({
        loading: false,
      } , () => this.pollForUpdates() );
    })
    .catch((err) => {
      console.error(err);
      this.setState({
        loading: false
      });
    })
  }
  componentWillUnmount() {
    this.context.actions.resetSinglePipelineState();
    clearInterval(this.state.timeoutInterval);
  }
  pollForUpdates() {
    this.setState({
      timeoutInterval: setTimeout(function() {
        this.context.actions.listRepos()
          .then(pipeline => this.pollForUpdates());
      }.bind(this), 25000)
    })
  }
  renderPage(pipeline) {
    switch (this.props.pipelineStore.section) {
      case "CONNECT_REPOSITORY":
        return this.renderConnectRepo();
      break;

      case "ADD_STAGE":
        return this.renderConnectStage();
      break;

      case "REMOVE_STAGE":
        return this.renderRemoveStage();
      break;

      default:
        if (!pipeline.containerRepoId) {
          return (
            <div>
              <div className="FlexRow JustifyCenter AlignCenter">
                <Btn onClick={() => this.context.actions.setPipelinePageSection("CONNECT_REPOSITORY") }
                     className="LargeBlueButton"
                     text="Connect Repository"
                     style={{marginTop: '28px'}}
                     canClick={true} />
              </div>
            </div>
          );
        } else {
          return this.renderPipeline();
        }
    }
  }
  renderPipeline() {
    if (!this.props.reposMap) return;
    let repoContainerPipeline = NPECheck(this.props, "pipelineStore/pipeline/containerRepoId", null);
    if (!repoContainerPipeline) {
        return <Msg text="No pipeline data found" />
    }
    let pipelineComponents = this.props.pipelineStore.pipeline.components.slice();
    let pipelineComponentsToRender = [];

    while (pipelineComponents.length > 0) {
      let nextComponent = pipelineComponents.shift();
      let automatic = true;
      let componentType = PipelineComponents.guessPipelineComponentType(nextComponent);
      if (!componentType.visible) {
        if (componentType === PipelineComponents.types.manualPromotionGate) {
          automatic = false;
        }
        nextComponent = pipelineComponents.shift();
      }
      pipelineComponentsToRender.push([nextComponent, automatic])
    }

    return (
      <div>
        <PipelineStageItem {...this.props}
                           firstStage={true}
                           repo={repoContainerPipeline} />
        {pipelineComponentsToRender.map((val) => {
          let component = val[0];
          let automatic = val[1];
          let idx = this.props.pipelineStore.pipeline.components.indexOf(component);

          return (
            <PipelineStageItem {...this.props}
                               key={component.id}
                               idx={idx}
                               pipelineComponentObj={component}
                               repo={this.props.reposMap[component.destinationContainerRepoId]}
                               automatic={automatic} />
          );
        })}
        <div className="FlexRow JustifyCenter AlignCenter">
          <Btn onClick={() => this.context.actions.setPipelinePageSection("ADD_STAGE") }
               className="LargeBlueButton"
               text="Add Stage"
               style={{marginTop: '28px'}}
               canClick={true} />
        </div>
      </div>
    );
  }
  renderPipelineStage(currentStage, previousStage) {

  }
  // Connect Repo
  renderConnectRepo() {
    return (
      <div style={ {margin: "14px 0 0"} }>
        <ControlRoom renderBodyContent={ this.connectRepoForm.bind(this) } />
      </div>
    );
  }
  connectRepoForm() {
    return (
      <PipelineConnectRepository initialConnect={true}
                                 {...this.props} />
    );
  }
  // Connect Stage
  renderConnectStage() {
    return (
      <div style={ {margin: "14px 0 0"} }>
        <ControlRoom renderBodyContent={ this.connectStageForm.bind(this) } />
      </div>
    );
  }
  connectStageForm() {
    return (
      <PipelineConnectRepository {...this.props} />
    );
  }
  // Remove Stage
  renderRemoveStage() {
    return (
      <div style={ {margin: "14px 0 0"} }>
        <ControlRoom renderBodyContent={ this.removeStageForm.bind(this) } />
      </div>
    );
  }
  removeStageForm() {
    return (
      <div>
        <div className="CR_Header">
          <span className="CR_HeaderTitle">
            Remove Pipeline
          </span>
          <span className="CR_HeaderClose">
            <i className="icon-dis-close"
               onClick={ () => this.context.actions.setPipelinePageSection(null) } />
          </span>
        </div>
        <div className="CR_BodyContent">
          <div className="Flex1">
            {this.renderConfirmDeletePipeline()}
          </div>
        </div>
      </div>
    );
  }
  renderConfirmDeletePipeline() {
    if (this.props.pipelinesStore.removePipelineXHR) {
      return (
        <div className="PageLoader">
          <Loader />
        </div>
      );
    }

    return (
      <div>
        {this.renderRemovePipelineErrorMsg()}
        <CenteredConfirm confirmButtonText="Remove"
                         message="Are you sure you want to remove this Pipeline?"
                         confirmButtonStyle={{}}
                         onConfirm={ this.context.actions.removePipeline }
                         onCancel={ () => this.context.actions.setPipelinePageSection(null) } />
      </div>
    );
  }
  renderRemovePipelineErrorMsg() {
    let error = NPECheck(this.props, 'pipelinesStore/removePipelineXHRError', false);
    if (error) {
      return (
        <Msg text={error}
           close={() => this.context.actions.clearPipelinesXHRErrors()} />
      );
    }
  }
  render() {
    let pipeline = this.props.pipelineStore.pipeline;

    if(NPECheck(this.props, 'pipelineStore/isBlocked', false)) {
      return (
        <AccessDenied />
      );
    }

    if(NPECheck(this.props, 'pipelineStore/noPipeline', false)) {
      return (
        <NotFound {...this.props} message="Pipeline Not Found."/>
      );
    }


    if (this.state.loading) {
      return (
        <div className="PageLoader">
          <Loader />
        </div>
      );
    }

    const buttons = [
      {
        icon: 'icon icon-dis-trash',
        toolTip: 'Remove Pipeline',
        onClick: () => this.context.actions.setPipelinePageSection("REMOVE_STAGE"),
        isActive: this.props.pipelinesStore.initNewPipeline
      }
    ]

    return (
      <div className="ContentContainer">
        <div className="PageHeader">
          <h2>
             {pipeline.name}
          </h2>
          <div className="FlexRow">
            <div className="Flex1">
              <BtnGroup buttons={buttons} />
            </div>
          </div>
        </div>
        <div className="project-pipeline">
          <div className="stages">
            {this.renderPage(pipeline)}
          </div>
        </div>
      </div>
    );
  }
}

Pipeline.childContextTypes = {
    actions: PropTypes.object,
    router: PropTypes.object
};

Pipeline.contextTypes = {
    actions: PropTypes.object,
    router: PropTypes.object
};
