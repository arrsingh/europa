/*
  @author Sam Heutmaker [samheutmaker@gmail.com]
*/

import React, {Component, PropTypes} from 'react'
import {Markdown} from 'react-showdown';
import NPECheck from './../util/NPECheck'
import Msg from './../components/Msg'
import Btn from './../components/Btn'
import Loader from './../components/Loader'

export default class RepoOverview extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.refs['readMeTextArea']) {
      this.refs['readMeTextArea'].focus();
    }
  }

  saveRepoOverview() {
    this.context.actions.saveRepoOverview()
    .then(this.context.actions.getRepoOverview);
  }

  renderReadMe() {
    let markdown = NPECheck(this.props, 'repoDetails/repoOverviewContent', '');

    if (!markdown) {
      return (
        <div className="TimelineContainer">
          <div className="Timeline">
            <div className="NoContent">
              <h3 key={1}>
                No Readme Found
              </h3>
              <Btn className="LargeBlueButton"
                   style={{maxWidth: '100%'}}
                   text="Create Readme"
                   onClick={() => this.context.actions.toggleRepoOverviewEdit()}/>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="ReadMe">
        <Markdown markup={markdown}/>
      </div>
    );
  }

  renderEditor() {
    let value = NPECheck(this.props, 'repoDetails/repoOverviewContent', '');
    return (
      <div>
        <div className="Editor">
          <textarea ref="readMeTextArea" value={value}
                    onChange={(e) => this.context.actions.updateRepoOverviewContent(e)}>
          </textarea>
        </div>
        {this.renderError()}
        {this.renderButtons()}
      </div>
    );
  }

  renderButtons() {
    let XHR = NPECheck(this.props, 'repoDetails/saveRepoOverviewXHR', false);

    if (XHR) {
      return (
        <Loader/>
      );
    }

    if (NPECheck(this.props, 'repoDetails/isOverviewModified', false)) {
      return (
        <div className="FlexRow ButtonContainer">
          <Btn text="Save Changes"
               onClick={() => this.saveRepoOverview()}/>
          <Btn className="Btn Cancel"
               text="Discard Changes"
               onClick={() => this.context.actions.discardRepoOverviewChanges()}/>
        </div>
      );
    }
  }

  renderError() {
    let error = NPECheck(this.props, 'repoDetails/repoOverviewError', false);
    if (error) {
      return (
        <Msg text={error}
             close={() => this.context.actions.clearRepoDetailsErrors()}
             style={{padding: '1rem 0'}}/>
      )
    }
  }

  render() {
    return (
      <div className="RepoOverview">
        {NPECheck(this.props, 'repoDetails/editOverview', false) ? this.renderEditor() : this.renderReadMe()}
      </div>
    );
  }
}

RepoOverview.childContextTypes = {
  actions: PropTypes.object
};

RepoOverview.contextTypes = {
  actions: PropTypes.object
};

