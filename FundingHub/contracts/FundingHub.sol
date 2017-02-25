pragma solidity ^0.4.7;
import 'Project.sol';
contract FundingHub { 
// FundingHub is the registry of all Projects to be funded
address owner;
mapping (address => uint8[]) public userProjects;    // user address => index of projects
uint8 public totalNumberProjects;   // acts as an ID for project lookup
Project[] public projects; 

event projectCreated(address projectAddress, address creator, string title); 

modifier onlyOwner { 
	if (msg.sender != owner) { throw; }
	_;
}
modifier noEther { 
		if (msg.value > 0) { throw; }
		_; 
}
	function () { 
		throw; 
	}

	function FundingHub() { 
		owner = msg.sender;
	}
	// Creates a new project contract. Requires Ether to cover the gas costs
	function createProject(uint256 _amountToBeRaised, uint256 _deadline, string _title, string _description) returns (address) {
		Project newProject = new Project(msg.sender, _amountToBeRaised, _deadline, _title, _description, 0, totalNumberProjects);
		projects.push(newProject);
		userProjects[msg.sender].push(totalNumberProjects); 
		totalNumberProjects++; 
		projectCreated(address(newProject), msg.sender, _title);
		return address(newProject); 
	}
	// Will send funds to project address if campaign is still ongoing, otherwise will return Ether
	// function contribute(uint8 projectID) payable returns (address) {
	// 	if (msg.value == 0) { return address(0); } 
	// 	Project fundProject = Project(projects[projectID]); 
	// 	address fundTx = fundProject.fund.value(msg.value).gas(msg.gas - 2000);
	// 	return fundTx; 
	// }
	function getAllProjects() noEther constant returns (Project[]) { 
		return projects; 
	}
	function getUserProjects(address user) noEther constant returns (Project[]) {
		Project[] memory userProjectList; 
		uint8[] projectIndexes = userProjects[user]; 
		for (uint8 i = 0; i < projectIndexes.length; i++) { 
			userProjectList[i] = projects[projectIndexes[i]]; 
		}
		return userProjectList; 
	}

	function kill() onlyOwner{
       selfdestruct(owner);
    }

}