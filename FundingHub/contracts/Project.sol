pragma solidity ^0.4.7;
contract Project { 
	address public projectCreator;
	address public fundingHub;
	string public title; 
	string public description;
	uint public amountToBeRaised;
	uint public amountRaised; 
	uint public deadline;
	uint public creationDate;
	uint public id; 



	mapping (address => uint) contributionLedger;
	address[] public contributors;
	bool public projectPaid; 

	modifier hub { 
		if (msg.sender != fundingHub) { throw; }
		_;
	}
	modifier noEther { 
		if (msg.value > 0) { throw; }
		_; 
	}

	function () { 
		throw; 
	}

	function getContributionAmount(address _contributor) noEther constant returns (uint) { 
		return contributionLedger[_contributor];
	}

	function Project(address _creator, uint _amountToBeRaised, uint _deadline, string _title, string _description, uint _amountRaised, uint _id) {
		if (_amountToBeRaised <= 0) { throw; }
		if (_deadline <= block.timestamp) { throw; }
		fundingHub = msg.sender;  
		projectCreator = _creator;
		amountRaised = _amountRaised; 
		title = _title; 
		description = _description; 
		amountToBeRaised = _amountToBeRaised;
		creationDate = block.timestamp; 
		deadline = _deadline;
		id = _id;
		projectPaid = false;
	}

	function fund() payable returns (bool) {
		if (msg.value == 0) { throw; }
		if (block.timestamp > deadline) { throw; }
		if (amountRaised > amountToBeRaised) { throw; }
		if (contributionLedger[msg.sender] == 0) {
			contributors.push(msg.sender);
		}
		contributionLedger[msg.sender] += msg.value; 
		amountRaised += msg.value;
		return true; 
	}

	// project creator can retrieve his funds here if campaign is over + success
	function payout() returns (uint) { 
		// if (msg.sender != projectCreator) { return 0; }
		// if (amountRaised < amountToBeRaised) { return 1; }
		// if (block.timestamp < deadline) { return 2; }
		if (projectPaid) {return 3; }
		projectPaid = true;
		if (!msg.sender.send(amountRaised)) { 
			projectPaid = true;
			return 4; 
		 }
		return 5; 
	}
	//  contributor can retrieve their funds here if campaign is over + failure. 
	function refund() noEther returns (uint) { 
		if (block.timestamp < deadline) { return 0; }
		if (amountRaised > amountToBeRaised) { return 1; }
		uint owed = contributionLedger[msg.sender];
		contributionLedger[msg.sender] = 0;
		if (!msg.sender.send(owed)) {
			contributionLedger[msg.sender] = owed;
			return 2;
		 } 
		return 3; 
	}
}