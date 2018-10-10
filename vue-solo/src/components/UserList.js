const UserInfo = () => import('./UserInfo.js');

export default {
  name: `UserList`,
  components: {
    UserInfo,
  },
  data() {
    return {
      users: [
        {
          img: `https://placeimg.com/50/50/people/1`,
          name: `Knight Kentigern`,
          department: `Dragoons`,
          info: `A champion of Lady Menerva, you fair knight have been selected to pursue
          the dragon harassing the good people of the Silver Lake district. Along with that mess,
          you can aid in the effors to modernize this library and slay the 10K+ line code base.`,
          showInfo: false,
        },
      ],
      showPeople: true,
    };
  },
  template: `
    <div v-if="showPeople" style="background: white; padding: 0px; margin: 0px; border-radius: 0px; opacity: 1; border: 1px solid black">
    <div style="display: flex; flex-direction: row; justify-content: space-between; width: 300px; height: 38px; background: black; border-bottom: 1px solid black">
      <div style="width: 250px; padding-left: 10px"><p style="color:white; font-size: 12px">Heroes Wanted: Join our Epic Port to Vue JS!</p></div>
      <div>
        <button
          style="border: 1px solid #666; padding: 5px; font-size: 12px; margin: 5px"
          @click="showPeople = !showPeople"
        >
          X
        </button>
      </div>
    </div>
    <ul style="list-style-type: none">
      <li v-for="user in users" :key="user.name">
        <img :src="user.img" :alt="user.name">
        <div>
          <h3 style="color: #666">{{ user.name }}</h3>
          <p style="color: #999; margin-bottom: 20px">{{ user.department }}</p>
          <button
            style="border: 1px solid #666; padding: 10px; font-size: 12px"
            @click="user.showInfo = !user.showInfo"
          >
            {{ !user.showInfo ? 'Learn more' : 'Less' }}
          </button>
          <user-info v-if="user.showInfo" style="max-width: 239px;">
            {{ user.info }}
            <a href="https://github.com/Azgaar/Fantasy-Map-Generator" target="_blank">github</a>
          </user-info>
        </div>
      </li>
    </ul>
    </div>
  `,
};
