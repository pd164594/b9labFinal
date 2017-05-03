// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/app.css";

// Import libraries we need.
import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'

// Import our contract artifacts and turn them into usable abstractions.
import fundingHubArtifacts from '../../build/contracts/FundingHub.json'
import projectArtifacts from '../../build/contracts/Project.json'


angular.module('fundingHub', [])

.controller('bodyControl', [
'$scope',
function($scope){

  $scope.createProject = false;

// FundingHub is our usable abstraction, which we'll use through the code below.
var FundingHub = contract(fundingHubArtifacts);
var Project = contract(projectArtifacts); 
// The following code is simple to show off interacting with your contracts.
// As your needs grow you will likely need to change its form and structure.
// For application bootstrapping, check out window.addEventListener below.
var accounts;
var account;
var shown = 0; 


window.App = {

  start: function() {
    var self = this;
    // Bootstrap the fundinghub abstraction for Use.
    FundingHub.setProvider(web3.currentProvider);
    Project.setProvider(web3.currentProvider);

    // Get the initial account balance so it can be displayed.
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

      self.refreshProjects();
    });
  },

  setStatus: function(message) {
    var status = document.getElementById("status");
    status.innerHTML = message;
  },

  refreshProjects: function() {
    var self = this;
    var fundHub;
    var amountRaised;
    var thisProject; 
    var thisProjectAddress;
    console.log("refresh projects called");
    return FundingHub.deployed()
    .then(function(instance) {
      var fundHub = instance; 
      // Fetch all projects
      return fundHub.getAllProjects.call();
    })
    .then(function(projectList) { 
      console.log(projectList); 
        var board = $('.projectDisplay');
        $.each(projectList, function( index, value ) {
          if (shown <= index) { 
            // Create a card for project info and funding option 
            var flexcard = '<div class="flexcard project textmiddle vertical-center horizontal-center column helvetica hover" id="projectCard'+thisProjectAddress+'>';
            thisProject = Project.at(value);
            return thisProject.title.call()
            .then(function(_title) { 
                flexcard += '<h1 class="mod marg title" id="projectTitle">'+_title+'</h1>';
                return thisProject.description.call(); 
            })
            .then(function(_description) {
              flexcard += '<p class="mod marg" id="projectDescription">' + _description + '</p>';
             // flexcard += '</div>';
             return thisProject.deadline.call(); 
            })
            .then(function(_deadline) { 
              var timestamp = Date.now() / 1000 | 0; 
              var deadlineInDays =(_deadline.valueOf() - timestamp) / 86400;
              var deadlineInDays = Math.round(deadlineInDays * 100) / 100;
              flexcard += '<h2 class="mod marg">' + deadlineInDays + ' days left</h2>';
              return thisProject.amountRaised.call(); 
            })
            .then(function(_amountRaised) { 
                amountRaised = _amountRaised; 
                return thisProject.amountToBeRaised.call(); 
            })
            .then(function(_amountToBeRaised) { 
                flexcard += '<h1 class="mod marg" id="amountToBeRaised">'+ amountRaised +' / '  + _amountToBeRaised.valueOf() + ' Wei raised</h1>'; 
                flexcard += '<h2 class="mod marg"> Project address:</h2>';
                flexcard += '<h2 class="mod marg">' + value + '</h2>';
                return thisProject.projectPaid.call(); 
            })
            .then(function(_paidBoolean) {
                flexcard += '<h3 class="mod marg"> Project Paid? '+ _paidBoolean + '</h2>';
                flexcard += '<label for="fundAmount" class="mod marg wide">Amount to send: </label>';
                flexcard += '<input class="mod marg wide" id="fundAmount"></input>';
                flexcard += '<button type="button" class="mod marg" onclick="App.fundProject(\'' + index + '\')">Fund project</button>';
                flexcard += '<div class="flex background-grey container row horizontal-around vertical-center">'; 
                flexcard += '<button class="mod marg bold background-black white hover" onclick="App.refund(\'' + index + '\')">Get Refund</button>'; 
                flexcard += '<button class="mod marg bold background-black white hover" onclick="App.payout(\'' + index + '\')">Payout</button>';
                flexcard += '</div>';
                flexcard += '</div>';
                return thisProject.projectCreator.call()
            })
            .then(function(_creator) { 
                board.append(flexcard);
                shown += 1;
                return true;
            });

          }  // closes if project list finished
      });   // closes foreach project loop
      });  // closes project list
  },
  fundProject: function(number) {
    var self = this;
    var amountToGive = document.getElementById("fundAmount").value;
    console.log("fundproject called");
    self.setStatus("Funding project... (please wait)");
    // console.log("funding project " + projectToFund + " with " + amount + " wei "); 
    var fundHub;
    var projectBeingFunded; 
    FundingHub.deployed().then(function(instance) {
      fundHub = instance;
      return fundHub.getAllProjects.call()
      .then(function(projectList) { 

      projectBeingFunded = Project.at(projectList[number]);
      return projectBeingFunded.fund.call({from:account, value:amountToGive, gas:200000}); 
      })
      .then(function(_success) {
        if (_success.valueOf()){ 
          self.setStatus("fundProject() call returns success asking user for transaction"); 
          console.log("fundProject() call returns success asking user for transaction"); 
        }
        else { 
          window.alert("funding failed");   // TODO return uint code to explain error in detail + provide solution
        }
      return projectBeingFunded.fund({from: account, value:amountToGive, gas:200000}); 
      })
      .then(function(receipt) { 
        console.log("transaction receipt logs: ");
        console.log(receipt.logs);
        self.setStatus("Project successfully funded");
      return projectBeingFunded.amountRaised.call() 
      })
      .then(function(_amountRaised) { 
        console.log("amount raised: "); 
        console.log(_amountRaised.valueOf());
      });
    });
  },
  refund: function(number)  {
    var fundHub; 
    var thisProject;
    var contributionAmount;
    FundingHub.deployed().then(function(instance) {
      fundHub = instance;
      return fundHub.getAllProjects.call(); 
      })
      .then(function(projectList) { 
      thisProject = Project.at(projectList[number]); 
      console.log("balance of sender: " + web3.eth.getBalance(account).valueOf()); 
      return thisProject.getContributionAmount.call(account);
      })
      .then(function(_amount) {
        console.log("refunding " + _amount.valueOf() + " to " + account);
        return thisProject.refund.call({from: account, gas: 100000})
      })
      .then(function(_result) {
        console.log("refund call result " + _result.valueOf()); 
        if (_result == 1) { 
          window.alert("This project has already reached it's goal");
        }
        return thisProject.refund({from: account, gas:100000}) 
      })
      .then(function(receipt) {
        console.log("transaction receipt: ");
        console.log(receipt.valueOf());
        console.log("balance of sender: " + web3.eth.getBalance(account).valueOf()); 
        return thisProject.getContributionAmount.call(account)
      })
      .then(function(_contributionAmount) {
        contributionAmount = _contributionAmount;  
        console.log("sender has contributed: " + contributionAmount);
        return thisProject.amountRaised.call()
      })
      .then(function(_amountRaised) {
        var projectAmount = _amountRaised.valueOf() - contributionAmount;  
        console.log("project now has " + projectAmount);
      });
  }, 

  payout: function(number) {
    var self = this;
    var fundHub;
    var thisProject;
    FundingHub.deployed().then(function(instance) {
      fundHub = instance;
      return fundHub.getAllProjects.call(); 
      })
      .then(function(projectList) { 
      thisProject = Project.at(projectList[number]); 
      return thisProject.amountRaised.call(); 
      })
      .then(function(_amountRaised) {
      console.log("refunding " + _amountRaised + " to account " + account);
      return thisProject.payout.call({from: account, gas:200000});  
      })
      .then(function(_result) { 
        console.log("payout returns value: " +  _result.valueOf());
        if (_result.valueOf() == 5) { 
          window.alert("Payout will be success, user must sign transaction & pay gas"); 
        }
        if (_result.valueOf() == 4) { 
          window.alert("Send() to the project creator failed, check receiving contract/wallet"); 
        }
        if (_result.valueOf() == 3) { 
          window.alert("Project creator has already been paid"); 
        }if (_result.valueOf() == 2) { 
          window.alert("The crowdfunding period is not yet over"); 
        }
        if (_result.valueOf() == 1) { 
          window.alert("Project has not yet reached crowdfunding goal"); 
        }
      })
      .then(function (receipt) {  
        console.log("transaction receipt logs");
        console.log(receipt.logs);
        self.setStatus("Project paid");
        });
  }, 

  createNewProject: function() { 
    var self = this; 
    var fundHub;
    console.log("funding hub is deployed");
    self.setStatus("Creating Project... (please wait)");
    var title = document.getElementById("title").value;
    var description = document.getElementById("description").value;
    var amount = parseInt(document.getElementById("amount").value);
    var deadline = parseInt(document.getElementById("deadline").value);
    var timestamp = Date.now() / 1000 | 0;
    var deadline = deadline * 86400;
    deadline += timestamp; 
    return FundingHub.deployed()
    .then(function(instance) { 
      fundHub = instance; 
      // amount = 6; 
      console.log("title: " + title +"amount:  " + amount +"deadline:  " + deadline +"timestamp:  " + timestamp +"description:  " + description); 
      return fundHub.createProject.call(amount , deadline, title, description, {from: account, gas:2000000}); 
    })
    .then(function (projectAddress) {
      console.log(projectAddress.valueOf()); 
      return fundHub.createProject(amount , deadline, title, description, {from: account, gas:2000000}); 
    })
    .then(function (txHash) {
      console.log("create project is working");
    //   return self.getTransactionReceiptMined(txHash);
    // })
    // .then(function (receipt) {  
        // console.log("transaction receipt");
        // console.log(receipt); 
        self.setStatus("Project created");
        if (!self.refreshProjects()) { 
          console.log("refreshProjects() failed"); 
        }
    });
  },
},

window.addEventListener('load', function() {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    console.warn("Using web3 detected from external source. If you find that your accounts don't appear or you have 0 FundingHub, ensure you've configured that source properly. If using MetaMask, see the following link. Feel free to delete this warning. :) http://truffleframework.com/tutorials/truffle-and-metamask")
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
  } else {
    console.warn("No web3 detected. Falling back to http://localhost:8545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
    // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
  }
  App.start();
}); 
}]); 
