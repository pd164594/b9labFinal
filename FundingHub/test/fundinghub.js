var FundingHub = artifacts.require("./FundingHub.sol");
var Project = artifacts.require("./Project.sol");

contract('FundingHub', function(accounts) {
var account = accounts[0];
var fundHub;
var numProjects = 0; 
var thisProject; 
  var title = 'A great title';
  var description = 'What a great title';
  var amount = 5000;
  var deadline = 5;
  var timestamp = Date.now() / 1000 | 0;
  var deadline = deadline * 86400;
  deadline += timestamp; 

  // Tests the fund() function
  it("should fund a project and attempt to fund more than allowed goal", function() {
    return FundingHub.deployed()
      .then(function(instance) {

      fundHub = instance; 

      return fundHub.createProject.call(amount, deadline, title, description, {from:account, gas:2000000});
      })
    .then(function (_projectAddress) {
    if (_projectAddress.valueOf != "0x") { 
      numProjects++; 
      console.log("project created successfully"); 
    }
    console.log("The project address will be:  " + _projectAddress.valueOf()); 
    return fundHub.createProject(amount , deadline, title, description, {from: account, gas:2000000}); 
    })
    .then(function (txHash) {  
          return fundHub.getAllProjects.call();
    })
    .then(function (_project) { 
          console.log("Funding hub returns 1 project with address:   " +_project[0]); 
          thisProject = Project.at(_project[numProjects - 1]);
          return thisProject.fund.call({from:account, value:amount, gas:200000}); 
    })
    .then(function( _success ) { 
        assert.equal(_success, true, " Funding the project failed from a call() ");
        if (!_success.valueOf()) { 
          console.log("funding of project " + thisProject + " failed" ); 
        }
        return thisProject.fund({from:account, value:amount, gas:200000}); // fund it with goal amount
    })
    .then(function(txHash) { 
        return thisProject.amountRaised.call(); 
    })
    .then(function (_amountRaised) { 
      console.log("amount raised so far " + _amountRaised.valueOf());
      assert.equal(_amountRaised.valueOf(), amount, "Funding the contract with " + amount + " did not work");
      return thisProject.amountToBeRaised.call();
    })
    .then(function (_amountToBeRaised) { 
      assert.equal(_amountToBeRaised, amount, "Amount to be raised should be same as amount variable"); 
      return thisProject.fund.call({from:account, value:500, gas:200000}); 
    })
    .then(function(success) {
      assert.equal(success, false, "Fund() should not accept payments once goal is reached");
        return thisProject.fund({from:account, value:500, gas:200000}); 
    })
    .then(function(txHash) { 
      return thisProject.amountRaised.call(); 
    })
    .then(function(_amountRaised) { 
      assert.equal(_amountRaised.valueOf(), amount, "contract should not take any more once goal is reached"); 
    })
    .catch(function(e) {
          console.log(e);
    });

    }); // closes it() 



// Tests the refund function
  it("should partially fund project and then receive refund", function() {
    return FundingHub.deployed()
    .then(function(instance) {

    fundHub = instance; 

    return fundHub.createProject.call(amount, deadline, title, description, {from:account, gas:2000000});
    })
    .then(function (_projectAddress) {
      if (_projectAddress.valueOf != "0x") { 
      numProjects++; 
      console.log("project created successfully"); 
      }
      else { 
        console.log("Project wasn't created successfully");
      }
    return fundHub.createProject(amount , deadline, title, description, {from: account, gas:2000000}); 
    })
    .then(function (txHash) {  
    return fundHub.getAllProjects.call();
    })
    .then(function (_project) {
    console.log(_project);
    console.log("Funding hub returns 1 project with address:   " +_project[numProjects - 1]); 
    thisProject = Project.at(_project[numProjects - 1]);
    return thisProject.fund.call({from:account, value:amount - 200, gas:200000}); 
    })
    .then(function( _success ) { 
        // assert.equal(_success, true, " Funding the project failed from a call() ");
        if (!_success.valueOf()) { 
          console.log("funding of project " + thisProject + " failed" ); 
        }
        return thisProject.fund({from:account, value:amount - 200, gas:200000}); // fund it with goal amount
    })
    .then(function(txHash) { 
        return thisProject.amountRaised.call(); 
    })
    .then(function (_amountRaised) { 
      console.log("amount raised so far " + _amountRaised.valueOf());
    return thisProject.refund.call({from:account, gas:90000}); 
  })
    .then(function(integerCode) { 
      assert.equal(integerCode, 3, "Should return a 3 to indicated a success of refund()" ); 
      return thisProject.refund({from:account, gas:90000}); 
    })
    .then(function(txHash) { 
      return thisProject.amountRaised.call();
    })
    .then(function(projectBalance) { 
      assert.equal(projectBalance, 0, "The refund failed"); 
    });

  }); // closes it()
});    // closes contract test
