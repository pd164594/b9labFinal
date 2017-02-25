angular.module('fundingHub', [])

.controller('bodyControl', [
'$scope',
function($scope){

  $scope.createProject = false;

var accounts;
var account;

var shown; 

function setStatus(message) {
  var status = document.getElementById("status");
  status.innerHTML = message;
};

// function waitForTransaction() { 
//   var currentBlock = web3.eth.blockNumber;
// setTimeout(function () {
//         console.log(web3.eth.blockNumber);
//         waitForTransaction();
//     }, 10000);  
// }

// var event = myContractInstance.MyEvent({valueA: 23} [, additionalFilterObject])

// // watch for changes
// event.watch(function(error, result){
//   if (!error)
//     console.log(result);
// });

getTransactionReceiptMined = function (txnHash, interval) {
    var transactionReceiptAsync;
    interval = interval ? interval : 500;
    transactionReceiptAsync = function(txnHash, resolve, reject) {
        try {
            var receipt = web3.eth.getTransactionReceipt(txnHash);
            if (receipt == null) {
                setTimeout(function () {
                    transactionReceiptAsync(txnHash, resolve, reject);
                }, interval);
            } else {
                resolve(receipt);
            }
        } catch(e) {
            reject(e);
        }
    };

    if (Array.isArray(txnHash)) {
        var promises = [];
        txnHash.forEach(function (oneTxHash) {
            promises.push(getTransactionReceiptMined(oneTxHash, interval));
        });
        return Promise.all(promises);
    } else {
        return new Promise(function (resolve, reject) {
                transactionReceiptAsync(txnHash, resolve, reject);
            });
    }
};

$scope.fundProject = function() { 
  var projectToFund = document.getElementById("fundAProject").value;
  var amountToGive = document.getElementById("fundAmount").value;
  console.log("sending " + amountToGive); 
  console.log("to project address: " + projectToFund); 
  console.log("balance of sender: " + web3.eth.getBalance(account).valueOf()); 
  var projectBeingFunded = Project.at(projectToFund);
  projectBeingFunded.fund.call({from:account, value:amountToGive, gas:200000})
  .then(function(_success) {
  if (!_success.valueOf()){ 
      setStatus("Project funding didn't work"); 
      return; 
    }
    return projectBeingFunded.fund({from: account, value:amountToGive, gas:200000}); 
  })
  .then(function(txHash) { 
    return getTransactionReceiptMined(txHash); 
  })
  .then(function(receipt) { 
    console.log("transaction receipt");
    console.log(receipt.valueOf());
    setStatus("Project successfully funded");
    return projectBeingFunded.amountRaised.call() })
      .then(function(_amountRaised) { 
      console.log("amount raised: "); 
      console.log(_amountRaised.valueOf());
    });
}; 
// 0 = timeline not over   1 = project successfully funded already   2 = send failed  3 = success
$scope.refund = function() {
  var projectAddress = document.getElementById("refund").value;
  var thisProject = Project.at(projectAddress); 
  thisProject.refund.call({from: account, gas: 200000})
  .then(function(_result) {
    console.log("refund call result " + _result.valueOf()); 
    return thisProject.refund({from: account, gas:200000}) })
  .then(function(txHash) {
    return getTransactionReceiptMined(txHash) })
  .then(function(receipt) { 
    console.log(receipt.valueOf());
    return;
  });
};

// 0 = not project creator  1= goal not reached yet  2= funding period not over  
// 3 = already paid out  4 = send failed    5 = success
$scope.payout = function() { 
  var projectToFund = document.getElementById("payout").value;
  var thisProject = Project.at(projectToFund); 
  thisProject.amountRaised.call().then(function(_amountRaised) {
  console.log("refunding " + _amountRaised + " to account " + account);  
  return thisProject.payout.call({from: account, gas:200000});  
  })
  .then(function(_result) { 
    console.log("payout returns value: " +  _result.valueOf());
    return thisProject.payout({from: account, gas:200000});
  })
  .then(function(txHash) { 
    return getTransactionReceiptMined(txHash);
  })
  .then(function (receipt) {  
    console.log("transaction receipt");
    console.log(receipt); 
    setStatus("Project paid");
    return;
    });
}; 
// Creates project cards
function refreshProjects() {
  var fundHub = FundingHub.deployed();
  var amountRaised;
 // Fetch all projects
  fundHub.getAllProjects.call().then(function(projectList) { 
      var board = $('.projectDisplay');
      $.each(projectList, function( index, value ) {
        if (shown <= index) { 
          // Create a card for project info and funding option 
        var flexcard = '<div class="flexcard project textmiddle vertical-center horizontal-center column helvetica marg hover">';
        var thisProject = Project.at(value);
         thisProject.title.call().then(function(_title) { 
          // var innercard = '<div class="flex vertical-center horizontal-center column helvetica hover">';
          flexcard += '<title class="mod marg title" id="projectTitle">'+_title+'</title>';
          return thisProject.description.call(); 
        }).then(function(_description) {
            flexcard += '<p class="mod marg" id="projectDescription">' + _description + '</p>';
            // flexcard += '</div>';
            return thisProject.deadline.call(); 
          }).then(function(_deadline) { 
            var timestamp = Date.now() / 1000 | 0; 
             var deadlineInDays =(_deadline.valueOf() - timestamp) / 86400;
             var deadlineInDays = Math.round(deadlineInDays * 100) / 100;
              flexcard += '<p class="mod marg">' + deadlineInDays + ' days left</p>';
              return thisProject.amountRaised.call(); 
            }).then(function(_amountRaised) { 
                amountRaised = _amountRaised; 
              return thisProject.amountToBeRaised.call(); 
            }).then(function(_amountToBeRaised) { 
              flexcard += '<p class="mod marg" id="amountToBeRaised">'+ amountRaised +' / '  + _amountToBeRaised.valueOf() + ' Wei raised</p>'; 
            //   return thisProject.id.call(); 
            // }).then(function(_id) { 
              flexcard += '<p class="mod marg"> Project address:</p>';
              flexcard += '<p class="mod marg">' + value + '</p>';
              return thisProject.projectPaid.call(); 
            }).then(function(_paidBoolean) { 
              flexcard += '<p class="mod marg"> Project Paid: '+ _paidBoolean + '</p>';
              flexcard += '</div>';
              return thisProject.projectCreator.call().then(function(_creator) { 
                console.log("project creator : " + _creator.valueOf());
                console.log("main account: " + account);
              board.append(flexcard);
              shown += 1;
              return;
              })
            });
         
      }
            });
          });
};


 $scope.createNewProject = function() {

  var fundHub = FundingHub.deployed();
  setStatus("Creating Project... (please wait)");
  var title = document.getElementById("title").value;
  var description = document.getElementById("description").value;
  var amount = parseInt(document.getElementById("amount").value);
  var deadline = parseInt(document.getElementById("deadline").value);
  var timestamp = Date.now() / 1000 | 0;
  var deadline = deadline * 86400;
  deadline += timestamp; 
  console.log("title: " + title +"amount:  " + amount +"deadline:  " + deadline +"timestamp:  " + timestamp +"description:  " + description); 


  fundHub.createProject.call(amount , deadline, title, description, {from: account, gas:2000000}).then(function (success) {
    console.log(success.valueOf()); 
    return fundHub.createProject(amount , deadline, title, description, {from: account, gas:2000000}); 
  }).then(function (txHash) {
           return getTransactionReceiptMined(txHash);
        }).then(function (receipt) {  
          console.log("transaction receipt");
          console.log(receipt); 
          setStatus("Project created");
          refreshProjects();
        }).catch(function(e) {
          console.log(e);
          setStatus("Project creation failed: ");
      }); 
};

window.onload = function() {

  web3.version.getNetwork((err, netId) => {
  switch (netId) {
    case "1":
      console.log('This is mainnet')
      break
    case "2":
      console.log('This is the deprecated Morden test network.')
      break
    case "3":
      console.log('This is the ropsten teest network.')
      break
    default:
      console.log('This is an unknown network.')
  }
});
  web3.eth.getAccounts(function(err, accs) {
    if (err != null) {  
      alert("There was an error fetching your accounts.");
      return;
    }

    if (accs.length == 0) {
      alert("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
      return;
    }

    accounts = accs;
    account = accounts[0];
    shown = 0;
    refreshProjects(); 

  });
}
}]);

