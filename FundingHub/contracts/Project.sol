pragma solidity ^0.4.8;

contract Project {
	// Created from Fundinghub, holds/distributes Ether for Project
	address public projectCreator;
	address public fundingHub;
	string public title; 
	string public description;
	uint256 public amountToBeRaised;
	uint256 public amountRaised = 0;  
	uint256 public deadline;
	uint256 public creationDate;
	uint256 public id; 



	mapping (address => uint256) contributionLedger;
	address[] public contributors;
	bool public projectPaid; 

	modifier hub { 
		if (msg.sender != fundingHub) { throw; }
		_;
	}

	function () { 
		throw; 
	}

	function getContributionAmount(address _contributor) constant returns (uint256) { 
		return contributionLedger[_contributor];
	}

	function Project(address _creator, uint256 _amountToBeRaised, uint256 _deadline, string _title, string _description, uint256 _id) {
		if (_amountToBeRaised <= 0) { throw; }
		if (_deadline <= block.timestamp) { throw; }
		fundingHub = msg.sender;  
		projectCreator = _creator;
		title = _title; 
		description = _description; 
		amountToBeRaised = _amountToBeRaised;
		creationDate = block.timestamp; 
		deadline = _deadline;
		id = _id;
		projectPaid = false;
	}

	function fund() payable returns (bool) {
		// if (block.timestamp >= deadline) { return false; }
		// if (amountRaised >= amountToBeRaised) { return false; }
		if (contributionLedger[msg.sender] == 0) {
			contributors.push(msg.sender);
		}
		contributionLedger[msg.sender] += msg.value; 
		amountRaised += msg.value;
		return true; 
	}

	// project creator can retrieve his funds here if campaign is over + success
	function payout() returns (uint256) { 
		if (msg.sender != projectCreator) { return 0; }
		if (amountRaised < amountToBeRaised) { return 1; }
		// if (block.timestamp < deadline) { return 2; }
		if (projectPaid) {return 3; }
		projectPaid = true;
		if (!msg.sender.send(amountRaised)) { 
			projectPaid = false;
			return 4; 
		 }
		return 5; 
	}
	//  contributor can retrieve their funds here if campaign is over + failure. 
	function refund() returns (uint256) { 
		// if (block.timestamp < deadline) { return 0; }
		if (amountRaised >= amountToBeRaised) { return 1; }
		uint256 owed = contributionLedger[msg.sender];
		contributionLedger[msg.sender] = 0;
		amountRaised = amountRaised - owed; 
		if (!msg.sender.send(owed)) {
			amountRaised += owed; 
			contributionLedger[msg.sender] = owed;
			return 2;
		 } 
		return 3; 
	}
}