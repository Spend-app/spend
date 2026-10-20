import toast from "react-hot-toast";

const Homepage = () => {
  return (
    <>
      <div>Homepage</div>
      <button onClick={() => toast.success("Button clicked!")}>Click Me</button>
    </>
  );
};

export default Homepage;
