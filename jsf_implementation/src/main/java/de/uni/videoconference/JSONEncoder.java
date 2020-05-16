package de.uni.videoconference;

import javax.websocket.EncodeException;
import javax.websocket.Encoder;
import javax.websocket.EndpointConfig;
import java.util.logging.Logger;

public class JSONEncoder implements Encoder.Text<Message> {
    private static final Logger log = Logger.getLogger(JSONEncoder.class.getName());

    @Override
    public String encode(Message object) throws EncodeException {
        return object.getJson().toString();
    }

    @Override
    public void init(EndpointConfig config) {
        log.info("init");
    }

    @Override
    public void destroy() {
        log.info("destroy");
    }

}
