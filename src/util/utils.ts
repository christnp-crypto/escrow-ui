// import * as borsh from 'borsh';

// class Assignable {
    
//   constructor(properties : any) {
//     Object.keys(properties).map((key) => {
//       return (this[key] = properties[key]);
//     });
//   }
// }


// class Task extends Assignable {}

// export default function BorshUtil() {
//   const example = {
//     id: "APPLE",
//     assignee: "Sai",
//     project_id: "ABX",
//     name: "Hello",
//     description: "Sample task Example",
//     status: "NOT DONE"
//   };

//   const schema = new Map([
//     [
//       Task,
//       {
//         kind: "struct",
//         fields: [
//           ["id", "string"],
//           ["name", "string"],
//           ["description", "string"],
//           ["assignee", "string"],
//           ["project_id", "string"],
//           ["status", "string"]
//         ]
//       }
//     ]
//   ]);
//   function hello() {
//     const task = new Task({
//       id: example.id,
//       name: example.name,
//       description: example.description,
//       assignee: example.assignee,
//       project_id: example.project_id,
//       status: example.status
//     });
//     console.log(task);
//     const buf = borsh.serialize(schema, task);
//     console.log(buf);
//     try {
//       const newValue = borsh.deserialize(schema, Task, buf);
//       console.log(newValue);
//     } catch (error) {
//       console.log(error);
//     }
//   }
//   return (
//     <div className="APPLE">
//       <button onClick={hello}>Create</button>
//     </div>
//   );
// }