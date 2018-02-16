/*
  @author Sam Heutmaker [samheutmaker@gmail.com]
*/

import React, {Component, PropTypes} from 'react'

export default class Msg extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  renderClose() {
    if (this.props.close && typeof this.props.close == 'function') {

      return (
        <i className="icon icon-dis-close" onClick={() => this.props.close()}/>
      )
    }
  }

  render() {

    let className = "Msg FlexColumn";

    if (this.props.isSuccess) {
      className += " Success";
    }

    return (
      <div className={className} style={this.props.style}>
        <p>{(this.props.text) ? this.props.text : ''}</p>
        {this.renderClose()}
      </div>
    );
  }
}


Msg.PropTypes = {
  isSuccess: PropTypes.bool,
  text: PropTypes.string,
  close: PropTypes.func,
  style: PropTypes.object
};

