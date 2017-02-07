/* eslint-disable space-before-function-paren, no-underscore-dangle, class-methods-use-this, consistent-return, no-shadow, no-param-reassign, max-len, no-unused-vars */
/* global ListIssue */
/* global ListLabel */

class List {
  constructor (obj) {
    this.id = obj.id;
    this._uid = this.guid();
    this.position = obj.position;
    this.title = obj.title;
    this.type = obj.list_type;
    this.preset = ['done', 'blank'].indexOf(this.type) > -1;
    this.filters = gl.issueBoards.BoardsStore.state.filters;
    this.page = 1;
    this.loading = true;
    this.loadingMore = false;
    this.issues = [];
    this.issuesSize = 0;

    if (obj.label) {
      this.label = new ListLabel(obj.label);
    }

    if (this.type !== 'blank' && this.id) {
      this.getIssues();
    }
  }

  guid() {
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  }

  save () {
    return gl.boardService.createList(this.label.id)
      .then((resp) => {
        const data = resp.json();

        this.id = data.id;
        this.type = data.list_type;
        this.position = data.position;

        return this.getIssues();
      });
  }

  destroy () {
    const index = gl.issueBoards.BoardsStore.state.lists.indexOf(this);
    gl.issueBoards.BoardsStore.state.lists.splice(index, 1);
    gl.issueBoards.BoardsStore.updateNewListDropdown(this.id);

    gl.boardService.destroyList(this.id);
  }

  update () {
    gl.boardService.updateList(this.id, this.position);
  }

  nextPage () {
    if (this.issuesSize > this.issues.length) {
      this.page += 1;

      return this.getIssues(false);
    }
  }

  getIssues (emptyIssues = true) {
    const filters = this.filters;
    const data = { page: this.page };

    Object.keys(filters).forEach((key) => { data[key] = filters[key]; });

    if (this.label) {
      data.label_name = data.label_name.filter(label => label !== this.label.title);
    }

    if (emptyIssues) {
      this.loading = true;
    }

    return gl.boardService.getIssuesForList(this.id, data)
      .then((resp) => {
        const data = resp.json();
        this.loading = false;
        this.issuesSize = data.size;

        if (emptyIssues) {
          this.issues = [];
        }

        this.createIssues(data.issues);
      });
  }

  newIssue (issue) {
    this.addIssue(issue);
    this.issuesSize += 1;

    return gl.boardService.newIssue(this.id, issue)
      .then((resp) => {
        const data = resp.json();
        issue.id = data.iid;
      });
  }

  createIssues (data) {
    data.forEach((issueObj) => {
      this.addIssue(new ListIssue(issueObj));
    });
  }

  addIssue (issue, listFrom, newIndex) {
    let moveBeforeIid;
    let moveAfterIid;

    if (!this.findIssue(issue.id)) {
      if (newIndex) {
        this.issues.splice(newIndex, 0, issue);

        moveBeforeIid = this.issues[newIndex - 1].id || null;
        moveAfterIid = this.issues[newIndex + 1].id || null;
      } else {
        this.issues.push(issue);
      }

      if (this.label) {
        issue.addLabel(this.label);
      }

      if (listFrom) {
        this.issuesSize += 1;
        gl.boardService.moveIssue(issue.id, listFrom.id, this.id, moveAfterIid, moveBeforeIid)
          .then(() => {
            listFrom.getIssues(false);
          });
      }
    }
  }

  moveIssue (issue, moveBeforeIid, moveAfterIid) {
    gl.boardService.moveIssue(issue.id, null, null, moveAfterIid, moveBeforeIid);
  }

  findIssue (id) {
    return this.issues.filter(issue => issue.id === id)[0];
  }

  removeIssue (removeIssue) {
    this.issues = this.issues.filter((issue) => {
      const matchesRemove = removeIssue.id === issue.id;

      if (matchesRemove) {
        this.issuesSize -= 1;
        issue.removeLabel(this.label);
      }

      return !matchesRemove;
    });
  }
}

window.List = List;
