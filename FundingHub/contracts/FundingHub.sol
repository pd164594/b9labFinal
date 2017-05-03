pragma solidity ^0.4.8;
import './Project.sol';
contract FundingHub { 
// FundingHub is the registry of all Projects to be funded
// Note: Should have mechanism to discard/archive old projects to avoid list from growing too large
address owner;
mapping (address => uint256[]) public userProjects;    // user address => index of projects
uint256 public totalNumberProjects;   // acts as an ID for project lookup
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
		Project newProject = new Project(msg.sender, _amountToBeRaised, _deadline, _title, _description, totalNumberProjects);
		projects.push(newProject);
		userProjects[msg.sender].push(totalNumberProjects); 
		totalNumberProjects++; 
		projectCreated(address(newProject), msg.sender, _title);
		return address(newProject); 
	}
	
	function getAllProjects() noEther constant returns (Project[]) { 
		return projects; 
	}
	function getUserProjects(address user) noEther constant returns (Project[]) {
		Project[] memory userProjectList; 
		uint256[] projectIndexes = userProjects[user]; 
		for (uint256 i = 0; i < projectIndexes.length; i++) { 
			userProjectList[i] = projects[projectIndexes[i]]; 
		}
		return userProjectList; 
	}

	function kill() onlyOwner{
       selfdestruct(owner);
    }

}