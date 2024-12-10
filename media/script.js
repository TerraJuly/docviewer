window.addEventListener('DOMContentLoaded', (event) => {
  const addButton = document.getElementById('addButton');
  const modal = document.getElementById('modal');
  const closeModal = document.getElementById('closeModal');
  const cancelButton = document.getElementById('cancelButton');
  const saveButton = document.getElementById('saveButton');
  const repoNameInput = document.getElementById('repoName');
  const repoPathInput = document.getElementById('repoPath');
  const repoBranchInput = document.getElementById('repoBranch');
  const repoSubDirInput = document.getElementById('repoSubDir');

  const repoList = document.getElementById('repoList').getElementsByTagName('tbody')[0];

  let currentEditIndex = null;

  addButton.addEventListener('click', () => {
    currentEditIndex = null;
    repoNameInput.value = '';
    repoPathInput.value = '';
    repoBranchInput.value = '';
    modal.style.display = 'block';
  });

  closeModal.onclick = () => {
    modal.style.display = 'none';
  };

  cancelButton.onclick = () => {
    modal.style.display = 'none';
  };

  saveButton.onclick = () => {
    const name = repoNameInput.value.trim();
    const path = repoPathInput.value.trim();
    const branch = repoBranchInput.value.trim();
    const subDir = repoSubDirInput.value.trim();
    const errorMessage = document.getElementById('error-message'); // 获取错误消息元素

    // 检查 name 和 path 是否为空
    if (name === '' || path === '' || branch === "" || subDir === "") {
      errorMessage.textContent = '以上信息不能为空！'; // 设置错误信息
      errorMessage.style.display = 'block'; // 显示错误信息
      return; // 停止执行后续代码
    } else {
      errorMessage.style.display = 'none'; // 隐藏错误信息
    }

    if (currentEditIndex === null) {
      vscode.postMessage({
        command: 'addRepo',
        repoName: name,
        repoPath: path,
        repoBranch: branch,
        repoSubDir: subDir
      });
    } else {
      vscode.postMessage({
        command: 'editRepo',
        index: currentEditIndex,
        repoName: name,
        repoPath: path,
        repoBranch: branch,
        repoSubDir: subDir
      });
    }

    modal.style.display = 'none';
  };

  // window load时 请求主线程 repolist
  vscode.postMessage({ command: 'requestRepoList' });

  // 请求到数据后，会检测主线程发送过来的信息
  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
      case 'updateRepoList':
        updateRepoList(message.data);
        break;
    }
  });

  const updateRepoList = (repos) => {
    repoList.innerHTML = ''; // 清空表格内容
    repos.forEach((repo, index) => {
      const tr = document.createElement('tr');

      // repo name
      const nameTd = document.createElement('td');
      nameTd.style.width = '60%';
      nameTd.textContent = repo.name;
      tr.appendChild(nameTd);

      //open
      const openTd = document.createElement('td');
      openTd.style.width = '10%';
      const openIcon = document.createElement('img');
      openIcon.src = iconPaths.view;
      openIcon.alt = 'Open';
      openIcon.title = "查看文档";
      openIcon.className = "img-icon";
      openIcon.onclick = () => {
        vscode.postMessage({ command: 'openRepo', repoName: repo.name, repoSubDir: repo.subDir });
      };
      openTd.appendChild(openIcon);
      tr.appendChild(openTd);

      //edit
      const editTd = document.createElement('td');
      editTd.style.width = '10%';
      const editIcon = document.createElement('img');
      editIcon.src = iconPaths.edit;
      editIcon.alt = 'Edit';
      editIcon.title = "修改仓库";
      editIcon.className = "img-icon";
      editIcon.onclick = () => {
        currentEditIndex = index;
        repoNameInput.value = repo.name;
        repoPathInput.value = repo.path;
        repoBranchInput.value = repo.branch;
        repoSubDirInput.value = repo.subDir;
        modal.style.display = 'block';
      };
      editTd.appendChild(editIcon);
      tr.appendChild(editTd);

      //delete
      const deleteTd = document.createElement('td');
      deleteTd.style.width = '10%';
      const deleteIcon = document.createElement('img');
      deleteIcon.src = iconPaths.minus;
      deleteIcon.alt = 'Delete';
      deleteIcon.title = "删除仓库";
      deleteIcon.className = "img-icon";
      // 绑定删除行为
      deleteIcon.onclick = () => {
        customConfirm(`确定要删除仓库【${repo.name}】吗?`, (confirmed) => {
          if (confirmed) {
            vscode.postMessage({ command: 'deleteRepo', index: index, repoName: repo.name, repoSubDir: repo.subDir });
          }
        });
      };
      deleteTd.appendChild(deleteIcon);
      tr.appendChild(deleteTd);

      //update
      const updateTd = document.createElement('td');
      updateTd.style.width = '10%';
      const updateIcon = document.createElement('img');
      updateIcon.src = iconPaths.update;
      updateIcon.alt = 'Update';
      updateIcon.title = "更新仓库";
      updateIcon.className = "img-icon";
      updateIcon.onclick = () => {
        vscode.postMessage({ command: 'updateRepo', repoName: repo.name, repoPath: repo.path, repoBranch: repo.branch, repoSubDir: repo.subDir });
      };
      updateTd.appendChild(updateIcon);
      tr.appendChild(updateTd);

      repoList.appendChild(tr);
    });
  };

  vscode.postMessage({ command: 'requestRepoData' });
});


function customConfirm(message, callback) {
  const modalOverlay = document.createElement('div');
  modalOverlay.style.position = 'fixed';
  modalOverlay.style.top = '0';
  modalOverlay.style.left = '0';
  modalOverlay.style.right = '0';
  modalOverlay.style.bottom = '0';
  modalOverlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modalOverlay.style.display = 'flex';
  modalOverlay.style.justifyContent = 'center';
  modalOverlay.style.alignItems = 'center';
  document.body.appendChild(modalOverlay);

  const dialog = document.createElement('div');
  dialog.style.backgroundColor = 'white';
  dialog.style.padding = '20px';
  dialog.style.borderRadius = '5px';
  dialog.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
  dialog.style.display = 'flex';
  dialog.style.flexDirection = 'column';
  dialog.style.alignItems = 'flex-end'; // Align items to the right
  dialog.style.gap = '5px'; // Gap between items including buttons

  const messageText = document.createElement('p');
  messageText.textContent = message;
  messageText.style.color = 'red';
  messageText.style.alignSelf = 'flex-start'; // Align text to the left
  dialog.appendChild(messageText);

  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex'; // Flex container for buttons
  buttonContainer.style.gap = '5px'; // Space between buttons

  const noButton = document.createElement('button');
  noButton.style.width = '80px'; // Ensure proper value setting
  noButton.textContent = 'No';
  noButton.onclick = () => {
    document.body.removeChild(modalOverlay);
    callback(false);
  };
  buttonContainer.appendChild(noButton);

  const yesButton = document.createElement('button');
  yesButton.style.width = '80px'; // Ensure proper value setting
  yesButton.textContent = 'Yes';
  yesButton.onclick = () => {
    document.body.removeChild(modalOverlay);
    callback(true);
  };
  buttonContainer.appendChild(yesButton);



  dialog.appendChild(buttonContainer);
  modalOverlay.appendChild(dialog);
  noButton.focus();
}
